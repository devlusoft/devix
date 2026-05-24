import {collectTurbo} from './turbo-client'
import {decodeTurboResponse} from './turbo-client'
import {FetchError} from './fetch'

export type ActionCtx = { request: Request }

export function action<T extends (...args: any[]) => any>(fn: T): T {
    return fn
}

export async function callServerAction<T = unknown>(
    file: string,
    name: string,
    args: unknown[],
): Promise<T> {
    const headers = new Headers()
    let body: BodyInit | undefined

    if (args.length === 1 && args[0] instanceof FormData) {
        body = args[0]
    } else if (args.length > 0) {
        body = await collectTurbo(args)
        headers.set('Content-Type', 'application/x-turbo')
    }

    const res = await fetch(`/_devix/actions/${file}/${name}`, {
        method: 'POST',
        headers,
        body,
    })

    const isEmpty = res.status === 204 || res.headers.get('Content-Length') === '0'
    const ct = res.headers.get('Content-Type') ?? ''

    let bodyData: unknown = undefined
    if (!isEmpty && ct.includes('application/json')) {
        try { bodyData = await res.json() } catch { }
    }

    if (bodyData && typeof bodyData === 'object' && 'redirect' in bodyData) {
        window.location.href = (bodyData as any).redirect
        return undefined as T
    }

    if (!res.ok) {
        throw new FetchError(res.status, res.statusText, res, bodyData)
    }

    if (isEmpty) return undefined as T

    if (ct.includes('application/octet-stream') || ct.includes('application/x-turbo')) {
        return decodeTurboResponse(res) as Promise<T>
    }

    if (ct.includes('application/json')) {
        return bodyData as T
    }

    return res.text() as unknown as T
}

;(globalThis as any).__devix_callServerAction = callServerAction
