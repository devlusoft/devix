import {DevixError, FetchError} from '@devlusoft/devix'
import {errorToBody, isRedirect, isLoaderError} from '../utils/response'
import {createTurboResponse, decodeFromRequest} from '../utils/turbo-serializer'
import {runWithQueryCache} from './query-cache'
import {__setFrame} from '../runtime/request-context'

interface ActionsGlob {
    actions: Record<string, () => Promise<Record<string, Function>>>
}

function normalizeActionKey(key: string): string {
    const idx = key.indexOf('/actions/')
    if (idx === -1) return key
    return key
        .slice(idx + '/actions/'.length)
        .replace(/\.(ts|tsx)$/, '')
        .replace(/\//g, '_')
}

export async function handleActionRequest(
    url: string,
    request: Request,
    glob: ActionsGlob,
): Promise<Response> {
    const responseHeaders = new Headers()

    const applyHeaders = (res: Response): Response => {
        for (const [k, v] of responseHeaders.entries()) {
            res.headers.append(k, v)
        }
        return res
    }

    try {
        const {pathname} = new URL(url, 'http://localhost')

        const match = pathname.match(/^\/_devix\/actions\/(.+?)\/(.+)$/)
        if (!match) return applyHeaders(new Response('Not Found', {status: 404}))

        const fileRel = match[1]
        const fnName = match[2]

        const actionKeys = Object.keys(glob.actions)
        const matchedKey = actionKeys.find(k => normalizeActionKey(k) === fileRel)
        if (!matchedKey) return applyHeaders(new Response('Not Found', {status: 404}))

        const mod = await glob.actions[matchedKey]() as Record<string, Function>
        const fn = mod[fnName]
        if (typeof fn !== 'function') return applyHeaders(new Response('Not Found', {status: 404}))

        const ct = request.headers.get('Content-Type') ?? ''
        let args: unknown[] = []
        if (request.method !== 'GET' && request.body) {
            if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
                args = [await request.formData()]
            } else if (ct.includes('application/octet-stream') || ct.includes('application/x-turbo')) {
                const decoded = await decodeFromRequest(request)
                args = Array.isArray(decoded) ? decoded : [decoded]
            } else if (ct.includes('application/json')) {
                const decoded = await request.json()
                args = Array.isArray(decoded) ? decoded : [decoded]
            } else {
                args = [await request.text()]
            }
        }

        let result: unknown
        __setFrame({request, responseHeaders})
        try {
            result = await runWithQueryCache(
                () => fn(...args),
                undefined,
                request,
                responseHeaders,
            )
        } finally {
            __setFrame(null)
        }

        if (isRedirect(result)) {
            return applyHeaders(new Response(JSON.stringify({
                redirect: result.url,
                redirectStatus: result.status,
                redirectReplace: result.replace,
            }), {
                status: result.status,
                headers: {'Content-Type': 'application/json'},
            }))
        }

        if (isLoaderError(result)) {
            const errBody = errorToBody(result)
            return applyHeaders(new Response(JSON.stringify(errBody), {
                status: errBody.statusCode,
                headers: {'Content-Type': 'application/json'},
            }))
        }

        return applyHeaders(createTurboResponse(result, request.signal))
    } catch (err) {
        if (isRedirect(err)) {
            return applyHeaders(new Response(JSON.stringify({
                redirect: err.url,
                redirectStatus: err.status,
                redirectReplace: err.replace,
            }), {
                status: err.status,
                headers: {'Content-Type': 'application/json'},
            }))
        }
        if (isLoaderError(err)) {
            const errBody = errorToBody(err)
            return applyHeaders(new Response(JSON.stringify(errBody), {
                status: errBody.statusCode,
                headers: {'Content-Type': 'application/json'},
            }))
        }
        if (err instanceof FetchError) {
            const body = err.body ?? {statusCode: err.status, message: err.statusText}
            return applyHeaders(new Response(JSON.stringify(body), {
                status: err.status,
                headers: {'Content-Type': 'application/json'},
            }))
        }
        if (err instanceof DevixError) {
            const body = errorToBody(err)
            return applyHeaders(new Response(JSON.stringify(body), {
                status: body.statusCode,
                headers: {'Content-Type': 'application/json'},
            }))
        }
        console.error('[devix] action error:', err)
        return applyHeaders(new Response(JSON.stringify({
            statusCode: 500, message: 'Internal Server Error',
        }), {status: 500, headers: {'Content-Type': 'application/json'}}))
    }
}
