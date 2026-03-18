import {buildRoutes, matchRoute, collectMiddlewareChain} from './api-router'
import {RouteContext} from '../runtime/api-context'
import type {RouteModule, MiddlewareModule} from '../runtime/api-context'
import type {ApiGlob} from './types'
import {DevixError} from '../runtime/error-boundary'

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

        const middlewareChain = collectMiddlewareChain(route.key, middlewares)
        for (const mw of middlewareChain) {
            const mod = await glob.middlewares[mw.key]() as MiddlewareModule
            if (mod.middleware) {
                const result = await mod.middleware(ctx, request)
                if (result instanceof Response) return result
            }
        }

        const mod = await glob.routes[route.key]() as RouteModule
        const method = request.method.toUpperCase() as keyof RouteModule
        const handler = mod[method]

        if (!handler) return new Response('Method Not Allowed', {status: 405})

        const result = await handler(ctx, request)
        if (result instanceof Response) return result
        if (result == null) return new Response(null, {status: 204})

        return new Response(JSON.stringify(result), {
            headers: {'Content-Type': 'application/json'},
        })
    } catch (err) {
        console.error('[devix] api error:', err)
        if (err instanceof DevixError) {
            return new Response(err.message, {status: err.statusCode})
        }
        return new Response('Internal Server Error', {status: 500})
    }
}