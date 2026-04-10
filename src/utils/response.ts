export type JsonResponse<T = unknown, S extends number = number> = Response & {
    readonly __body: T
    readonly __status: S
}

export function json<const T>(data: T): JsonResponse<T, 200>
export function json<const T, const S extends number>(data: T, status: S): JsonResponse<T, S>
export function json<const T>(data: T, status: number = 200): JsonResponse<T, any> {
    return new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'},
    }) as JsonResponse<T, any>
}

export const text = (body: string, status = 200): Response =>
    new Response(body, {status, headers: {'Content-Type': 'text/plain; charset=utf-8'}})

const REDIRECT_BRAND = Symbol.for('devix.redirect')

export interface RedirectOptions {
    status?: number
    replace?: boolean
}

export interface Redirect {
    readonly [REDIRECT_BRAND]: true
    readonly url: string
    readonly status: number
    readonly replace: boolean
}

export function redirect(url: string, statusOrOptions?: number | RedirectOptions): Redirect {
    const status = typeof statusOrOptions === 'number' ? statusOrOptions : (statusOrOptions?.status ?? 302)
    const replace = typeof statusOrOptions === 'object' ? (statusOrOptions?.replace ?? false) : false
    return {[REDIRECT_BRAND]: true, url, status, replace} as Redirect
}

export function isRedirect(value: unknown): value is Redirect {
    return typeof value === 'object' && value !== null && REDIRECT_BRAND in value
}

const ERROR_BRAND = Symbol.for('devix.loaderError')

export interface RouteError {
    readonly [ERROR_BRAND]: true
    readonly statusCode: number
    readonly message: string
    readonly data?: unknown
}

export function error(statusCode: number, message: string, data?: unknown): RouteError {
    return { [ERROR_BRAND]: true, statusCode, message, data } as RouteError
}

export function isLoaderError(value: unknown): value is RouteError {
    return typeof value === 'object' && value !== null && ERROR_BRAND in value
}
