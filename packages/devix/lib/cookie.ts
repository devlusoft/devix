export interface CookieOptions {
  expires?: Date | number | string
  maxAge?: number
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

function encodeCookieValue(value: string): string {
  return encodeURIComponent(value)
}

function decodeCookieValue(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseCookieHeader(header: string, name: string): string | undefined {
  const entries = header.split(';')
  for (const entry of entries) {
    const trimmed = entry.trim()
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (key === name) {
      return decodeCookieValue(rawValue)
    }
  }
  return undefined
}

export function getCookie(name: string, request?: Request): string | undefined {
  const header =
    request?.headers.get('cookie') ?? (typeof document !== 'undefined' ? document.cookie : '')
  if (!header) return undefined
  return parseCookieHeader(header, name)
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeCookieValue(value)}`]

  if (options.expires) {
    const date = options.expires instanceof Date ? options.expires : new Date(options.expires)
    parts.push(`Expires=${date.toUTCString()}`)
  }
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }
  if (options.path) {
    parts.push(`Path=${options.path}`)
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }
  if (options.secure) {
    parts.push('Secure')
  }
  if (options.httpOnly) {
    parts.push('HttpOnly')
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  const headerValue = parts.join('; ')

  if (typeof document !== 'undefined') {
    // biome-ignore lint/suspicious/noDocumentCookie: isomorphic cookie helper sets document.cookie on the client
    document.cookie = headerValue
  }

  return headerValue
}

export function deleteCookie(
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {},
): string {
  return setCookie(name, '', { ...options, expires: new Date(0), maxAge: 0 })
}
