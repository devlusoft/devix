export type JsonResponse<T = unknown> = Response & { readonly __body: T }

export const json = <const T>(data: T, status = 200): JsonResponse<T> =>
    new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'},
    }) as JsonResponse<T>

export const text = (body: string, status = 200): Response =>
    new Response(body, {status, headers: {'Content-Type': 'text/plain; charset=utf-8'}})

export const redirect = (url: string, status = 302): Response =>
    new Response(null, {status, headers: {Location: url}})
