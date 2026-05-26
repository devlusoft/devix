import {DevixError, FetchError} from '@devlusoft/devix'
import {errorToBody, isRedirect, isLoaderError} from '../utils/response'
import {createTurboResponse, decodeFromRequest} from '../utils/turbo-serializer'
import {runWithQueryCache} from './query-cache'
import {__setFrame} from '../runtime/request-context'
import {getAction} from './actions-registry'

export async function handleActionRequest(
    url: string,
    request: Request,
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
        const actionId = pathname.split('/').pop()
        if (!actionId) return applyHeaders(new Response('Not Found', {status: 404}))

        const fn = getAction(actionId)
        if (typeof fn !== 'function') return applyHeaders(new Response('Not Found', {status: 404}))

        const args = await decodeFromRequest(request)
        const argsArray = Array.isArray(args) ? args : [args]

        let result: unknown
        __setFrame({request, responseHeaders})
        try {
            result = await runWithQueryCache(
                () => fn(...argsArray),
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

