import {describe, it, expect} from 'vitest'
import {getCookie, setCookie, deleteCookie} from '../../src/utils/cookies'

function makeReq(cookieHeader?: string): Request {
    const headers = new Headers()
    if (cookieHeader) headers.set('cookie', cookieHeader)
    return new Request('http://localhost/', {headers})
}

describe('getCookie', () => {
    it('devuelve el valor de una cookie existente', () => {
        expect(getCookie(makeReq('token=abc123'), 'token')).toBe('abc123')
    })

    it('devuelve undefined si la cookie no existe', () => {
        expect(getCookie(makeReq('other=value'), 'token')).toBeUndefined()
    })

    it('devuelve undefined si no hay header Cookie', () => {
        expect(getCookie(makeReq(), 'token')).toBeUndefined()
    })

    it('parsea múltiples cookies', () => {
        expect(getCookie(makeReq('a=1; b=2; c=3'), 'b')).toBe('2')
    })

    it('decodifica valores URL-encoded', () => {
        expect(getCookie(makeReq('name=hello%20world'), 'name')).toBe('hello world')
    })

    it('maneja valores con = en el contenido', () => {
        const b64 = 'dGVzdA=='
        expect(getCookie(makeReq(`token=${encodeURIComponent(b64)}`), 'token')).toBe(b64)
    })
})

describe('setCookie', () => {
    it('añade Set-Cookie con Path=/ por defecto', () => {
        const headers = new Headers()
        setCookie(headers, 'session', 'xyz')
        expect(headers.get('set-cookie')).toContain('session=xyz')
        expect(headers.get('set-cookie')).toContain('Path=/')
    })

    it('añade HttpOnly y Secure cuando se indican', () => {
        const headers = new Headers()
        setCookie(headers, 'token', 'abc', {httpOnly: true, secure: true})
        const value = headers.get('set-cookie')!
        expect(value).toContain('HttpOnly')
        expect(value).toContain('Secure')
    })

    it('añade Max-Age', () => {
        const headers = new Headers()
        setCookie(headers, 'token', 'abc', {maxAge: 3600})
        expect(headers.get('set-cookie')).toContain('Max-Age=3600')
    })

    it('añade SameSite', () => {
        const headers = new Headers()
        setCookie(headers, 'token', 'abc', {sameSite: 'Strict'})
        expect(headers.get('set-cookie')).toContain('SameSite=Strict')
    })

    it('usa Path personalizado', () => {
        const headers = new Headers()
        setCookie(headers, 'token', 'abc', {path: '/admin'})
        expect(headers.get('set-cookie')).toContain('Path=/admin')
    })

    it('codifica el valor', () => {
        const headers = new Headers()
        setCookie(headers, 'data', 'hello world')
        expect(headers.get('set-cookie')).toContain('data=hello%20world')
    })
})

describe('deleteCookie', () => {
    it('setea Max-Age=0 y fecha expirada', () => {
        const headers = new Headers()
        deleteCookie(headers, 'session')
        const value = headers.get('set-cookie')!
        expect(value).toContain('session=')
        expect(value).toContain('Max-Age=0')
    })
})
