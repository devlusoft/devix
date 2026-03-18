export interface CookieOptions {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
    maxAge?: number
    expires?: Date
    path?: string
    domain?: string
}

export function getCookie(req: Request, name: string): string | undefined {
    const header = req.headers.get('cookie')
    if (!header) return undefined
    for (const part of header.split(';')) {
        const [key, ...rest] = part.trim().split('=')
        if (key.trim() === name) return decodeURIComponent(rest.join('='))
    }
    return undefined
}

export function setCookie(headers: Headers, name: string, value: string, options: CookieOptions = {}): void {
    let cookie = `${name}=${encodeURIComponent(value)}; Path=${options.path ?? '/'}`
    if (options.domain)             cookie += `; Domain=${options.domain}`
    if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`
    if (options.expires)            cookie += `; Expires=${options.expires.toUTCString()}`
    if (options.httpOnly)           cookie += `; HttpOnly`
    if (options.secure)             cookie += `; Secure`
    if (options.sameSite)           cookie += `; SameSite=${options.sameSite}`
    headers.append('Set-Cookie', cookie)
}

export function deleteCookie(headers: Headers, name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
    setCookie(headers, name, '', {...options, maxAge: 0, expires: new Date(0)})
}
