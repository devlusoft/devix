import {getFrame} from '../runtime/request-context'

export interface CookieOptions {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
    maxAge?: number
    expires?: Date
    path?: string
    domain?: string
}

export function getCookie(name: string): string | undefined
export function getCookie(req: Request, name: string): string | undefined
export function getCookie(reqOrName: Request | string, name?: string): string | undefined {
    let req: Request | null
    if (typeof reqOrName === 'string') {
        const frame = getFrame()
        req = frame?.request ?? null
        name = reqOrName
    } else {
        req = reqOrName
    }
    if (!req) return undefined
    const header = req.headers.get('cookie')
    if (!header) return undefined
    for (const part of header.split(';')) {
        const [key, ...rest] = part.trim().split('=')
        if (key.trim() === name!) return decodeURIComponent(rest.join('='))
    }
    return undefined
}

export function setCookie(headers: Headers, name: string, value: string, options?: CookieOptions): void
export function setCookie(name: string, value: string, options?: CookieOptions): void
export function setCookie(headersOrName: Headers | string, nameOrValue: string, valueOrOptions?: string | CookieOptions, options?: CookieOptions): void {
    let headers: Headers | null
    let name: string
    let value: string
    let opts: CookieOptions | undefined
    if (headersOrName instanceof Headers) {
        headers = headersOrName
        name = nameOrValue
        value = valueOrOptions as string
        opts = options
    } else {
        const frame = getFrame()
        headers = frame?.responseHeaders ?? null
        name = headersOrName
        value = nameOrValue
        opts = valueOrOptions as CookieOptions | undefined
    }
    if (!headers) return
    let cookie = `${name}=${encodeURIComponent(value)}; Path=${opts?.path ?? '/'}`
    if (opts?.domain)                 cookie += `; Domain=${opts.domain}`
    if (opts?.maxAge !== undefined)   cookie += `; Max-Age=${opts.maxAge}`
    if (opts?.expires)                cookie += `; Expires=${opts.expires.toUTCString()}`
    if (opts?.httpOnly)               cookie += `; HttpOnly`
    if (opts?.secure)                 cookie += `; Secure`
    if (opts?.sameSite)               cookie += `; SameSite=${opts.sameSite}`
    headers.append('Set-Cookie', cookie)
}

export function deleteCookie(headers: Headers, name: string, options?: Pick<CookieOptions, 'path' | 'domain'>): void
export function deleteCookie(name: string, options?: Pick<CookieOptions, 'path' | 'domain'>): void
export function deleteCookie(headersOrName: Headers | string, nameOrOptions?: string | Pick<CookieOptions, 'path' | 'domain'>, options?: Pick<CookieOptions, 'path' | 'domain'>): void {
    let headers: Headers | null
    let name: string
    let opts: Pick<CookieOptions, 'path' | 'domain'> | undefined
    if (headersOrName instanceof Headers) {
        headers = headersOrName
        name = nameOrOptions as string
        opts = options
    } else {
        const frame = getFrame()
        headers = frame?.responseHeaders ?? null
        name = headersOrName
        opts = nameOrOptions as Pick<CookieOptions, 'path' | 'domain'> | undefined
    }
    if (!headers) return
    setCookie(headers, name, '', {...opts, maxAge: 0, expires: new Date(0)})
}
