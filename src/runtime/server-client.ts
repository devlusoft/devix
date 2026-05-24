import type {ServerNamespaces} from './index'

export interface ServerFetchOptions {
    headers?: HeadersInit
    signal?: AbortSignal
}

export interface BackendClient {
    get<TResponse = unknown>(path: string, options?: ServerFetchOptions): Promise<TResponse>
    post<TResponse = unknown>(path: string, body?: unknown, options?: ServerFetchOptions): Promise<TResponse>
    put<TResponse = unknown>(path: string, body?: unknown, options?: ServerFetchOptions): Promise<TResponse>
    patch<TResponse = unknown>(path: string, body?: unknown, options?: ServerFetchOptions): Promise<TResponse>
    delete<TResponse = unknown>(path: string, options?: ServerFetchOptions): Promise<TResponse>
}
export type ServerClient = {
    [K in keyof ServerNamespaces]: BackendClient
}
