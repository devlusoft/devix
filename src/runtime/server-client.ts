import {FetchError, type HttpMethod} from './fetch'

/**
 * Interface declarable por el usuario para tipar las rutas de cada backend
 * configurado en `devix.config.ts`. Las claves siguen el formato
 * `'<namespace> <METHOD> <path>'`.
 *
 * ```ts
 * declare module '@devlusoft/devix' {
 *   interface BackendRoutes {
 *     'api GET /v1/me': { __response: User }
 *     'api POST /v1/posts': { __body: { title: string }; __response: Post }
 *     'stripe POST /v1/customers': { __body: CreateCustomerInput; __response: Customer }
 *   }
 * }
 * ```
 */
export interface BackendRoutes {}

type BackendKey<NS extends string, M extends HttpMethod, P extends string> = `${NS} ${M} ${P}`
type MatchingBackendKey<NS extends string, M extends HttpMethod, P extends string> = {
    [K in keyof BackendRoutes]: K extends BackendKey<NS, M, P> ? K : never
}[keyof BackendRoutes]
type BackendRouteData<NS extends string, M extends HttpMethod, P extends string> = BackendRoutes[MatchingBackendKey<NS, M, P>]

type ExtractBackendBody<D> = D extends { __body: infer B } ? B : never
type ExtractBackendResponse<D> = D extends { __response: infer R } ? R : unknown
type InferBackendBody<NS extends string, M extends HttpMethod, P extends string> = ExtractBackendBody<BackendRouteData<NS, M, P>>
type InferBackendResult<NS extends string, M extends HttpMethod, P extends string> = ExtractBackendResponse<BackendRouteData<NS, M, P>>
type BackendBodyOption<NS extends string, M extends HttpMethod, P extends string> =
    [InferBackendBody<NS, M, P>] extends [never] ? unknown : InferBackendBody<NS, M, P>

type BackendPaths<NS extends string> = {
    [K in keyof BackendRoutes]: K extends `${NS} ${HttpMethod} ${infer P}` ? P : never
}[keyof BackendRoutes]
type BackendPath<NS extends string> = BackendPaths<NS> | (string & {})

export interface ServerFetchOptions<NS extends string = string, M extends HttpMethod = 'GET', P extends string = string> {
    body?: BackendBodyOption<NS, M, P>
    headers?: HeadersInit
    signal?: AbortSignal
}

const PROXY_PREFIX = '/_devix/server'

async function proxyFetch<NS extends string, M extends HttpMethod, P extends string>(
    namespace: NS,
    method: M,
    path: P,
    options?: ServerFetchOptions<NS, M, P>,
): Promise<InferBackendResult<NS, M, P>> {
    const headers = new Headers(options?.headers)
    let body: BodyInit | undefined
    if (options?.body !== undefined) {
        if (options.body instanceof FormData || options.body instanceof Blob || options.body instanceof ArrayBuffer) {
            body = options.body
        } else {
            body = JSON.stringify(options.body)
            if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
        }
    }

    const url = `${PROXY_PREFIX}/${namespace}${path}`
    const response = await fetch(url, {method, headers, body, signal: options?.signal})

    const isEmptyBody = response.status === 204 || response.headers.get('Content-Length') === '0'

    if (!response.ok) {
        const ct = response.headers.get('Content-Type') ?? ''
        let errorBody: unknown
        if (!isEmptyBody && ct.includes('application/json')) {
            try { errorBody = await response.json() } catch { /* body vacío o inválido */ }
        }
        throw new FetchError(response.status, response.statusText, response, errorBody)
    }

    if (isEmptyBody) return null as InferBackendResult<NS, M, P>

    const ct = response.headers.get('Content-Type') ?? ''
    if (ct.includes('application/json')) return response.json() as Promise<InferBackendResult<NS, M, P>>
    return response.text() as unknown as Promise<InferBackendResult<NS, M, P>>
}

export interface BackendClient<NS extends string> {
    get<P extends BackendPath<NS>>(path: P, options?: Omit<ServerFetchOptions<NS, 'GET', P>, 'body'>): Promise<InferBackendResult<NS, 'GET', P>>
    post<P extends BackendPath<NS>>(path: P, body?: BackendBodyOption<NS, 'POST', P>, options?: Omit<ServerFetchOptions<NS, 'POST', P>, 'body'>): Promise<InferBackendResult<NS, 'POST', P>>
    put<P extends BackendPath<NS>>(path: P, body?: BackendBodyOption<NS, 'PUT', P>, options?: Omit<ServerFetchOptions<NS, 'PUT', P>, 'body'>): Promise<InferBackendResult<NS, 'PUT', P>>
    patch<P extends BackendPath<NS>>(path: P, body?: BackendBodyOption<NS, 'PATCH', P>, options?: Omit<ServerFetchOptions<NS, 'PATCH', P>, 'body'>): Promise<InferBackendResult<NS, 'PATCH', P>>
    delete<P extends BackendPath<NS>>(path: P, options?: Omit<ServerFetchOptions<NS, 'DELETE', P>, 'body'>): Promise<InferBackendResult<NS, 'DELETE', P>>
}

function makeBackendClient<NS extends string>(namespace: NS): BackendClient<NS> {
    return {
        get: (path, options) => proxyFetch(namespace, 'GET', path, options) as any,
        post: (path, body, options) => proxyFetch(namespace, 'POST', path, {...options, body} as any) as any,
        put: (path, body, options) => proxyFetch(namespace, 'PUT', path, {...options, body} as any) as any,
        patch: (path, body, options) => proxyFetch(namespace, 'PATCH', path, {...options, body} as any) as any,
        delete: (path, options) => proxyFetch(namespace, 'DELETE', path, options) as any,
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
 * const me = await $server.api.get('/v1/me')
 * const post = await $server.api.post('/v1/posts', { title: 'Hola' })
 * ```
 */
export const $server: Record<string, BackendClient<string>> = new Proxy({} as Record<string, BackendClient<string>>, {
    get(target, namespace: string) {
        if (typeof namespace !== 'string') return undefined
        if (!target[namespace]) target[namespace] = makeBackendClient(namespace)
        return target[namespace]
    },
})
