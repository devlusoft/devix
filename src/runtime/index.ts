export {useRouter, useNavigate, useRevalidate, useParams, useLoaderData, useGuardData, useSearchParams, RouterProvider} from "./router-provider"

export {Link} from "./link"

export type { Metadata, MetadataIcon, Viewport, LoaderContext, LoaderContextWithGuard, LoaderFunction, GuardFunction } from '../types'
export type { NavigateOptions } from './context'
export type { PageProps, LayoutProps, PageModule, LayoutModule, ErrorProps } from '../server/types'
export type { RouteHandler, RouteResult, MiddlewareModule } from './api-context'
export {getCookie, setCookie, deleteCookie} from '../utils/cookies'
export type {CookieOptions} from '../utils/cookies'
export {json, text, redirect, error, defer} from '../utils/response'
export {query} from './query'
export {createAsync} from './create-async'
export {AwaitData} from './await-data'
export type {JsonResponse, Redirect, RedirectOptions, RouteError, ErrorOptions, ErrorBody} from '../utils/response'
export {createHandler} from './create-handler'
export type {DevixHandler} from './create-handler'
export type {StandardSchemaV1} from '../utils/standard-schema'
export {FetchError} from './fetch'
export {$server} from './server-client'
export type {BackendClient, ServerFetchOptions} from './server-client'
export {action} from './action'
export type {ActionCtx} from './action'
export {DevixError} from './error-boundary'
export { decode as decodeTurbo } from 'turbo-stream'
export { decodeResponse } from '../utils/turbo-serializer'
export {actions} from './actions-client'
export type {DevixErrorOptions} from './error-boundary'
export type {HttpMethod} from './fetch'

import {FetchError, type HttpMethod} from './fetch'

export interface ApiRoutes {}
export interface ServerNamespaces {}
export interface Actions {}

type ApiKey<M extends HttpMethod, P extends string> = `${M} ${P}`
type MatchingKey<M extends HttpMethod, P extends string> = {
    [K in keyof ApiRoutes]: K extends ApiKey<M, P> ? K : never
}[keyof ApiRoutes]
type RouteData<M extends HttpMethod, P extends string> = ApiRoutes[MatchingKey<M, P>]
type AllApiPaths = {
    [K in keyof ApiRoutes]: K extends `${HttpMethod} ${infer P}` ? P : never
}[keyof ApiRoutes]
type ApiPath = AllApiPaths | (string & {})
type ExtractBody<D> = D extends { __body: infer B } ? B : never
type ExtractResponse<D> = D extends { __response: infer R } ? R : D
type InferBody<M extends HttpMethod, P extends string> = ExtractBody<RouteData<M, P>>
type InferResult<M extends HttpMethod, P extends string> = ExtractResponse<RouteData<M, P>>
type BodyOption<M extends HttpMethod, P extends string> = [InferBody<M, P>] extends [never] ? unknown : InferBody<M, P>

export interface FetchOptions<M extends HttpMethod = 'GET', P extends string = string> {
    method?: M
    body?: BodyOption<M, P>
    headers?: HeadersInit
    signal?: AbortSignal
}

export async function $fetch<P extends ApiPath = ApiPath, M extends HttpMethod = 'GET'>(
    path: P,
    options?: FetchOptions<M, P>
): Promise<InferResult<M, P>> {
    const method = options?.method ?? 'GET'
    const headers = new Headers(options?.headers)

    let body: BodyInit | undefined
    if (options?.body !== undefined) {
        if (options.body instanceof FormData || options.body instanceof Blob || options.body instanceof ArrayBuffer) {
            body = options.body
        } else {
            body = JSON.stringify(options.body)
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json')
            }
        }
    }

    const response = await fetch(path, {method, headers, body, signal: options?.signal})

    const isEmptyBody = response.status === 204 || response.headers.get('Content-Length') === '0'

    if (!response.ok) {
        const contentType = response.headers.get('Content-Type') ?? ''
        let errorBody: unknown
        if (!isEmptyBody && contentType.includes('application/json')) {
            try { errorBody = await response.json() } catch { /* body vacío o inválido */ }
        }
        throw new FetchError(response.status, response.statusText, response, errorBody)
    }

    if (isEmptyBody) return null as InferResult<M, P>

    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('application/json')) {
        return response.json() as Promise<InferResult<M, P>>
    }

    return response.text() as unknown as Promise<InferResult<M, P>>
}
