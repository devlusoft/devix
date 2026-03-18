export interface ApiRoutes {}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface FetchOptions<M extends HttpMethod = 'GET'> {
    method?: M
    body?: unknown
    headers?: HeadersInit
    signal?: AbortSignal
}

type ApiKey<M extends HttpMethod, P extends string> = `${M} ${P}`

type InferResult<M extends HttpMethod, P extends string> =
    ApiKey<M, P> extends keyof ApiRoutes
        ? ApiRoutes[ApiKey<M, P>]
        : unknown

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
    P extends string,
    M extends HttpMethod = 'GET',
>(path: P, options?: FetchOptions<M>): Promise<InferResult<M, P>> {
    const method = (options?.method ?? 'GET') as string
    const headers = new Headers(options?.headers)

    let body: BodyInit | undefined
    if (options?.body !== undefined) {
        body = JSON.stringify(options.body)
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json')
        }
    }

    const response = await fetch(path, {method, headers, body, signal: options?.signal})

    if (!response.ok) {
        throw new FetchError(response.status, response.statusText, response)
    }

    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('application/json')) {
        return response.json() as Promise<InferResult<M, P>>
    }

    return response.text() as unknown as Promise<InferResult<M, P>>
}
