export const json = (data: unknown, status = 200): Response =>
    Response.json(data, {status})

export const text = (body: string, status = 200): Response =>
    new Response(body, {status, headers: {'Content-Type': 'text/plain; charset=utf-8'}})

export const redirect = (url: string, status = 302): Response =>
    new Response(null, {status, headers: {Location: url}})
