export type JsonResponse<T = unknown> = Response & { readonly __body: T }

export const json = <const T>(data: T, status = 200): JsonResponse<T> =>
    new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'},
    }) as JsonResponse<T>

export const text = (body: string, status = 200): Response =>
    new Response(body, {status, headers: {'Content-Type': 'text/plain; charset=utf-8'}})

const REDIRECT_BRAND = Symbol('devix.redirect')

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
