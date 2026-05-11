import {FetchError, type HttpMethod} from '../runtime/fetch'
import {matchesAnyGlob} from '../utils/glob'
import type {ServerBackendConfig, PrepareContext} from '../config'
import type {BackendClient} from '../runtime/server-client'

/**
 * Construye un `$server` server-side bound al request del usuario.
 *
 * Diferencias clave vs el `$server` cliente:
 * - Hace fetch directo a `backend.url + path` (sin pasar por el proxy interno).
 * - Aplica `prepare` con el `Request` del loader/handler para que pueda leer cookies.
 * - Aplica allowlist/denylist por simetría con el proxy cliente.
 */
export function makeBoundServer(
    request: Request,
    config: Record<string, ServerBackendConfig> | undefined,
): Record<string, BackendClient<string>> {
    if (!config) return new Proxy({} as any, {
        get(_t, namespace: string) {
            throw new Error(`[devix] ctx.$server.${String(namespace)} called but no 'server' config is defined in devix.config.ts`)
        },
    })

    const cache = new Map<string, BackendClient<string>>()
    return new Proxy({} as any, {
        get(_t, namespace: string) {
            if (typeof namespace !== 'string') return undefined
            const backend = config[namespace]
            if (!backend) {
                throw new Error(`[devix] ctx.$server.${namespace} — namespace "${namespace}" not configured in devix.config.ts`)
            }
            let client = cache.get(namespace)
            if (!client) {
                client = makeBackendClientBound(namespace, backend, request)
                cache.set(namespace, client)
            }
            return client
        },
    })
}

function makeBackendClientBound(
    _namespace: string,
    backend: ServerBackendConfig,
    userRequest: Request,
): BackendClient<string> {
    async function call<TResult>(method: HttpMethod, path: string, body?: unknown, options?: {headers?: HeadersInit; signal?: AbortSignal}): Promise<TResult> {
        if (!matchesAnyGlob(path, backend.allowedPaths)) {
            throw new FetchError(403, 'Path not allowed', new Response(null, {status: 403}), {
                statusCode: 403, message: 'Path not allowed', code: 'PATH_NOT_ALLOWED',
            })
        }
        if (matchesAnyGlob(path, backend.deniedPaths)) {
            throw new FetchError(403, 'Path denied', new Response(null, {status: 403}), {
                statusCode: 403, message: 'Path denied', code: 'PATH_DENIED',
            })
        }

        const targetUrl = new URL(path, backend.url)
        const headers = new Headers(options?.headers)
        if (backend.prepare) {
            const ctx: PrepareContext = {request: userRequest, headers, url: targetUrl}
            const result = await backend.prepare(ctx)
            if (result instanceof Response) {
                throw new FetchError(
                    result.status,
                    result.statusText,
                    result,
                    await readErrorBody(result),
                )
            }
        }

        let sendBody: BodyInit | undefined
        if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
            if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
                sendBody = body
            } else {
                sendBody = JSON.stringify(body)
                if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
            }
        }

        const response = await fetch(targetUrl, {method, headers, body: sendBody, signal: options?.signal})
        const isEmpty = response.status === 204 || response.headers.get('Content-Length') === '0'

        if (!response.ok) {
            const ct = response.headers.get('Content-Type') ?? ''
            let errorBody: unknown
            if (!isEmpty && ct.includes('application/json')) {
                try { errorBody = await response.json() } catch { /* body inválido */ }
            }
            throw new FetchError(response.status, response.statusText, response, errorBody)
        }

        if (isEmpty) return null as TResult

        const ct = response.headers.get('Content-Type') ?? ''
        if (ct.includes('application/json')) return await response.json() as TResult
        return await response.text() as unknown as TResult
    }

    return {
        get: ((path: string, options?: any) => call('GET', path, undefined, options)) as BackendClient<string>['get'],
        post: ((path: string, body?: any, options?: any) => call('POST', path, body, options)) as BackendClient<string>['post'],
        put: ((path: string, body?: any, options?: any) => call('PUT', path, body, options)) as BackendClient<string>['put'],
        patch: ((path: string, body?: any, options?: any) => call('PATCH', path, body, options)) as BackendClient<string>['patch'],
        delete: ((path: string, options?: any) => call('DELETE', path, undefined, options)) as BackendClient<string>['delete'],
    }
}

async function readErrorBody(res: Response): Promise<unknown> {
    const ct = res.headers.get('Content-Type') ?? ''
    if (ct.includes('application/json')) {
        try { return await res.json() } catch { return undefined }
    }
    return undefined
}
