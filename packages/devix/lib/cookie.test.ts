import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteCookie, getCookie, setCookie } from './cookie'

describe('getCookie', () => {
  it('returns undefined when no cookies are present', () => {
    const request = new Request('http://localhost/', { headers: {} })
    expect(getCookie('session', request)).toBeUndefined()
  })

  it('parses a cookie from a request header', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'session=abc123; other=xyz' },
    })
    expect(getCookie('session', request)).toBe('abc123')
    expect(getCookie('other', request)).toBe('xyz')
  })

  it('decodes URL-encoded values', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'data=hello%20world' },
    })
    expect(getCookie('data', request)).toBe('hello world')
  })

  it('returns undefined for missing names', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'session=abc123' },
    })
    expect(getCookie('missing', request)).toBeUndefined()
  })

  it('falls back to document.cookie on the client', () => {
    vi.stubGlobal('document', { cookie: 'client=value' })
    expect(getCookie('client')).toBe('value')
    vi.unstubAllGlobals()
  })
})

describe('setCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('serializes a basic cookie', () => {
    const header = setCookie('session', 'abc123')
    expect(header).toBe('session=abc123')
  })

  it('encodes values', () => {
    const header = setCookie('data', 'hello world')
    expect(header).toBe('data=hello%20world')
  })

  it('serializes options', () => {
    const expires = new Date('2026-01-01T00:00:00.000Z')
    const header = setCookie('session', 'abc123', {
      expires,
      maxAge: 3600,
      path: '/',
      domain: 'example.com',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    })
    expect(header).toContain('session=abc123')
    expect(header).toContain(`Expires=${expires.toUTCString()}`)
    expect(header).toContain('Max-Age=3600')
    expect(header).toContain('Path=/')
    expect(header).toContain('Domain=example.com')
    expect(header).toContain('Secure')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=lax')
  })

  it('sets document.cookie on the client', () => {
    const cookieStore: string[] = []
    vi.stubGlobal('document', {
      get cookie() {
        return cookieStore.join('; ')
      },
      set cookie(value: string) {
        cookieStore.push(value)
      },
    })
    setCookie('session', 'abc123', { path: '/' })
    expect(cookieStore[0]).toBe('session=abc123; Path=/')
  })
})

describe('deleteCookie', () => {
  it('expires the cookie immediately', () => {
    const header = deleteCookie('session', { path: '/' })
    expect(header).toContain('session=')
    expect(header).toContain('Max-Age=0')
    expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
    expect(header).toContain('Path=/')
  })
})
