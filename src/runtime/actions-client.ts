import type {Actions} from './index'
import {FetchError} from './fetch'
import {decode, encode as turboEncode} from 'turbo-stream'
import {collectTurbo} from './turbo-client'

const ACTIONS_PREFIX = '/_devix/actions'

function createActionFn(file: string, name: string) {
    return async (...args: any[]) => {
        const headers = new Headers()
        let body: BodyInit | undefined

        if (args.length === 1 && args[0] instanceof FormData) {
            body = args[0]
        } else if (args.length > 0) {
            body = await collectTurbo(args)
            headers.set('Content-Type', 'application/x-turbo')
        }

        const res = await fetch(`${ACTIONS_PREFIX}/${file}/${name}`, {
            method: 'POST',
            headers,
            body,
        })

        const isEmpty = res.status === 204 || res.headers.get('Content-Length') === '0'

        if (!res.ok) {
            const ct = res.headers.get('Content-Type') ?? ''
            let errorBody: unknown
            if (!isEmpty && ct.includes('application/json')) {
                try {
                    errorBody = await res.json()
                } catch {  }
            }
            throw new FetchError(res.status, res.statusText, res, errorBody)
        }

        if (isEmpty) return

        const ct = res.headers.get('Content-Type') ?? ''
        if (ct.includes('application/octet-stream') || ct.includes('application/x-turbo')) {
            return decode(res.body!.pipeThrough(new TransformStream<Uint8Array, string>({
                transform(chunk, controller) {
                    controller.enqueue(new TextDecoder().decode(chunk, {stream: true}))
                }
            })))
        }

        if (ct.includes('application/json')) {
            const json = await res.json()
            if (json && typeof json === 'object' && 'redirect' in json) {
                window.location.href = json.redirect
                return
            }
            return json
        }

        return res.text()
    }
}

export const actions: Actions = new Proxy({} as Record<string, Record<string, Function>>, {
    get(target, file: string) {
        if (typeof file !== 'string') return undefined
        if (!target[file]) {
            target[file] = new Proxy({} as Record<string, Function>, {
                get(_t, name: string) {
                    if (typeof name !== 'string') return undefined
                    if (!_t[name]) _t[name] = createActionFn(file, name)
                    return _t[name]
                },
            })
        }
        return target[file]
    },
}) as Actions
