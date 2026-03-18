import {buildRoutes, matchRoute, collectMiddlewareChain} from './api-router'
import {RouteContext} from '../runtime/api-context'
import type {RouteModule, MiddlewareModule, RouteResult} from '../runtime/api-context'
import type {ApiGlob} from './types'
import {DevixError} from '../runtime/error-boundary'
import {HANDLER_BRAND, type DevixHandler} from '../runtime/create-handler'
import {withHandlerStore} from './handler-store'

function isDevixHandler(h: unknown): h is DevixHandler<any, any> {
    return typeof h === 'object' && h !== null && HANDLER_BRAND in h
}

async function parseBody(request: Request): Promise<unknown> {
    const ct = request.headers.get('Content-Type') ?? ''
    if (ct.includes('application/json')) return request.json()
    if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
        return request.formData()
    }
    return request.text()
}

function resultToResponse(result: RouteResult): Response {
    if (result instanceof Response) return result
    if (result == null) return new Response(null, {status: 204})
    return new Response(JSON.stringify(result), {
        headers: {'Content-Type': 'application/json'},
    })
}

export async function handleApiRequest(
    url: string,
    request: Request,
    glob: ApiGlob,
): Promise<Response> {
    try {
        const {pathname} = new URL(url, 'http://localhost')
        const {routes, middlewares} = buildRoutes(
            Object.keys(glob.routes),
            Object.keys(glob.middlewares),
            glob.apiDir,
        )
        const matched = matchRoute(pathname, routes)

        if (!matched) return new Response('Not Found', {status: 404})

        const {route, params} = matched
        const ctx = new RouteContext(params)

        const result = await withHandlerStore({request, ctx}, async () => {
            const middlewareChain = collectMiddlewareChain(route.key, middlewares)
            for (const mw of middlewareChain) {
                const mod = await glob.middlewares[mw.key]() as MiddlewareModule
                if (mod.middleware) {
                    const mwResult = await mod.middleware(ctx, request)
                    if (mwResult instanceof Response) return mwResult
                }
            }

            const mod = await glob.routes[route.key]() as RouteModule
            const method = request.method.toUpperCase() as keyof RouteModule
            const handler = mod[method]

            if (!handler) return new Response('Method Not Allowed', {status: 405})

            if (isDevixHandler(handler)) {
                if (handler.fn.length === 0) {
                    return handler.fn() as Promise<RouteResult>
                }
                const body = await parseBody(request)
                return handler.fn(body) as Promise<RouteResult>
            }

            return handler(ctx, request)
        })

        return resultToResponse(result)
    } catch (err) {
        console.error('[devix] api error:', err)
        if (err instanceof DevixError) {
            return new Response(err.message, {status: err.statusCode})
        }
        return new Response('Internal Server Error', {status: 500})
    }
}
