import {describe, it, expect} from 'vitest'
import {json, text, redirect} from '../../src/utils/response'

describe('json', () => {
    it('devuelve 200 por defecto', async () => {
        const res = json({ok: true})
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ok: true})
    })

    it('respeta el status indicado', async () => {
        const res = json({error: 'Unauthorized'}, 401)
        expect(res.status).toBe(401)
    })

    it('setea Content-Type application/json', () => {
        const res = json({})
        expect(res.headers.get('content-type')).toContain('application/json')
    })
})

describe('text', () => {
    it('devuelve 200 por defecto', async () => {
        const res = text('pong')
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('pong')
    })

    it('respeta el status indicado', () => {
        expect(text('error', 400).status).toBe(400)
    })

    it('setea Content-Type text/plain', () => {
        expect(text('hi').headers.get('content-type')).toContain('text/plain')
    })
})

describe('redirect', () => {
    it('devuelve 302 por defecto', () => {
        const res = redirect('/login')
        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe('/login')
    })

    it('respeta el status indicado', () => {
        expect(redirect('/home', 301).status).toBe(301)
    })
})
