import {buildRoutes, matchRoute, collectMiddlewareChain, ApiResult} from './api-router'
import {RouteContext} from '../runtime/api-context'
import type {RouteModule, MiddlewareModule, RouteResult} from '../runtime/api-context'
import type {ApiGlob} from './types'
import {DevixError} from '../runtime/error-boundary'
import {HANDLER_BRAND, type DevixHandler} from '../runtime/create-handler'
import {withHandlerStore} from './handler-store'
import {error, errorToBody, isLoaderError} from '../utils/response'
import type {ServerBackendConfig} from '../config'
import {makeBoundServer} from './server-bound'

let apiCache: ApiResult | null = null
let apiCacheKey: string | null = null

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

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

function resultToResponse(result: RouteResult): Response {
    if (result instanceof Response) return result
    if (isLoaderError(result)) return jsonResponse(errorToBody(result), result.statusCode)
    if (result == null) return new Response(null, {status: 204})
    return new Response(JSON.stringify(result), {
        headers: {'Content-Type': 'application/json'},
    })
}

export async function handleApiRequest(
    url: string,
    request: Request,
    glob: ApiGlob,
    serverConfig?: Record<string, ServerBackendConfig>,
): Promise<Response> {
    try {
        const {pathname} = new URL(url, 'http://localhost')
        const cacheKey = Object.keys(glob.routes).sort().join('\0') + '|' + Object.keys(glob.middlewares).sort().join('\0')
        if (!apiCache || apiCacheKey !== cacheKey) {
            apiCache = buildRoutes(
                Object.keys(glob.routes),
                Object.keys(glob.middlewares),
                glob.apiDir,
            )
            apiCacheKey = cacheKey
        }
        const {routes, middlewares} = apiCache
        const matched = matchRoute(pathname, routes)

        if (!matched) return new Response('Not Found', {status: 404})

        const {route, params} = matched
        const $server = makeBoundServer(request, serverConfig)
        const ctx = new RouteContext(params, request, new URL(url, 'http://localhost'), $server)

        const result = await withHandlerStore({request, ctx}, async () => {
            const middlewareChain = collectMiddlewareChain(route.key, middlewares)
            for (const mw of middlewareChain) {
                const mod = await glob.middlewares[mw.key]() as MiddlewareModule
                if (mod.middleware) {
                    const mwResult = await mod.middleware(ctx)
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
                const rawBody = await parseBody(request)
                if (handler.schema) {
                    const result = await handler.schema['~standard'].validate(rawBody)
                    if (result.issues) {
                        return error(400, 'Validation failed', {
                            code: 'VALIDATION_ERROR',
                            data: {issues: result.issues},
                        })
                    }
                    return handler.fn(result.value, ctx) as Promise<RouteResult>
                }
                return handler.fn(rawBody, ctx) as Promise<RouteResult>
            }

            return handler(ctx)
        })

        return resultToResponse(result)
    } catch (err) {
        if (err instanceof DevixError) {
            return jsonResponse(errorToBody(err), err.statusCode)
        }
        console.error('[devix] api error:', err)
        return jsonResponse({statusCode: 500, message: 'Internal Server Error'}, 500)
    }
}
