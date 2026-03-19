export interface ApiRoutes { }

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

type ApiKey<M extends HttpMethod, P extends string> = `${M} ${P}`

type RouteData<M extends HttpMethod, P extends string> =
    ApiKey<M, P> extends keyof ApiRoutes ? ApiRoutes[ApiKey<M, P>] : unknown

type AllApiPaths = {
    [K in keyof ApiRoutes]: K extends `${HttpMethod} ${infer P}` ? P : never
}[keyof ApiRoutes]

type ApiPath = [AllApiPaths] extends [never] ? string : AllApiPaths | (string & {})

type ExtractBody<D> = D extends { __body: infer B } ? B : never
type UnwrapReturn<R> =
    R extends { __body: infer B } ? B
    : R extends void | undefined ? never
    : R
type ExtractResponse<D> =
    D extends { __return: infer R } ? UnwrapReturn<R>
    : D extends { __response: infer R } ? R
    : D

type InferBody<M extends HttpMethod, P extends string> = ExtractBody<RouteData<M, P>>
type InferResult<M extends HttpMethod, P extends string> = ExtractResponse<RouteData<M, P>>

type BodyOption<M extends HttpMethod, P extends string> =
    [InferBody<M, P>] extends [never] ? unknown : InferBody<M, P>

export interface FetchOptions<M extends HttpMethod = 'GET', P extends string = string> {
    method?: M
    body?: BodyOption<M, P>
    headers?: HeadersInit
    signal?: AbortSignal
}

export class FetchError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly response: Response,
    ) {
        super(`HTTP ${status}: ${statusText}`)
        this.name = 'FetchError'
    }
}

export async function $fetch<
    P extends ApiPath = ApiPath,
    M extends HttpMethod = 'GET',
>(path: P, options?: FetchOptions<M, P>): Promise<InferResult<M, P>> {
    const method = (options?.method ?? 'GET') as string
    const headers = new Headers(options?.headers)

    let body: BodyInit | undefined
    if (options?.body !== undefined) {
        body = JSON.stringify(options.body)
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json')
        }
    }

    const response = await fetch(path, { method, headers, body, signal: options?.signal })

    if (!response.ok) {
        throw new FetchError(response.status, response.statusText, response)
    }

    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('application/json')) {
        return response.json() as Promise<InferResult<M, P>>
    }

    return response.text() as unknown as Promise<InferResult<M, P>>
}
