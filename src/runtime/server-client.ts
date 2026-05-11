import {FetchError, type HttpMethod} from './fetch'

export interface ServerFetchOptions {
    headers?: HeadersInit
    signal?: AbortSignal
}

const PROXY_PREFIX = '/_devix/server'

async function proxyFetch<TResponse>(
    namespace: string,
    method: HttpMethod,
    path: string,
    body: unknown,
    options?: ServerFetchOptions,
): Promise<TResponse> {
    const headers = new Headers(options?.headers)
    let sendBody: BodyInit | undefined
    if (body !== undefined && body !== null) {
        if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
            sendBody = body
        } else {
            sendBody = JSON.stringify(body)
            if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
        }
    }

    const url = `${PROXY_PREFIX}/${namespace}${path}`
    const response = await fetch(url, {method, headers, body: sendBody, signal: options?.signal})

    const isEmptyBody = response.status === 204 || response.headers.get('Content-Length') === '0'

    if (!response.ok) {
        const ct = response.headers.get('Content-Type') ?? ''
        let errorBody: unknown
        if (!isEmptyBody && ct.includes('application/json')) {
            try { errorBody = await response.json() } catch { /* body vacío o inválido */ }
        }
        throw new FetchError(response.status, response.statusText, response, errorBody)
    }

    if (isEmptyBody) return null as TResponse

    const ct = response.headers.get('Content-Type') ?? ''
    if (ct.includes('application/json')) return await response.json() as TResponse
    return await response.text() as unknown as TResponse
}

/**
 * Cliente para llamar a un backend remoto configurado en `devix.config.ts`.
 *
 * El tipo de respuesta se declara en cada call site con un generic:
 *
 * ```ts
 * const me = await $server.api.get<User>('/v1/me')
 * const post = await $server.api.post<Post>('/v1/posts', { title: 'Hola' })
 * ```
 *
 * Si no pasas el generic, el retorno es `unknown`. devix no puede inferir tipos del
 * backend remoto (vive fuera del repo) — el cast en el call site ES el contrato.
 */
export interface BackendClient {
    get<TResponse = unknown>(path: string, options?: ServerFetchOptions): Promise<TResponse>
    post<TResponse = unknown>(path: string, body?: unknown, options?: ServerFetchOptions): Promise<TResponse>
    put<TResponse = unknown>(path: string, body?: unknown, options?: ServerFetchOptions): Promise<TResponse>
    patch<TResponse = unknown>(path: string, body?: unknown, options?: ServerFetchOptions): Promise<TResponse>
    delete<TResponse = unknown>(path: string, options?: ServerFetchOptions): Promise<TResponse>
}

function makeBackendClient(namespace: string): BackendClient {
    return {
        get: (path, options) => proxyFetch(namespace, 'GET', path, undefined, options),
        post: (path, body, options) => proxyFetch(namespace, 'POST', path, body, options),
        put: (path, body, options) => proxyFetch(namespace, 'PUT', path, body, options),
        patch: (path, body, options) => proxyFetch(namespace, 'PATCH', path, body, options),
        delete: (path, options) => proxyFetch(namespace, 'DELETE', path, undefined, options),
    }
}

/**
 * Cliente para llamar a backends remotos configurados en `devix.config.ts`.
 *
 * En cliente: las requests pasan por el proxy interno `/_devix/server/<namespace>/...`
 * donde devix aplica `prepare` (auth pass-through, tracing, etc.) y reenvía al backend.
 *
 * En server (loaders/handlers): NO uses este import — usa `ctx.$server` que recibe
 * el request del usuario para que `prepare` pueda leer cookies.
 *
 * ```ts
 * const me = await $server.api.get<User>('/v1/me')
 * const post = await $server.api.post<Post>('/v1/posts', { title: 'Hola' })
 * ```
 */
export const $server: Record<string, BackendClient> = new Proxy({} as Record<string, BackendClient>, {
    get(target, namespace: string) {
        if (typeof namespace !== 'string') return undefined
        if (!target[namespace]) target[namespace] = makeBackendClient(namespace)
        return target[namespace]
    },
})
