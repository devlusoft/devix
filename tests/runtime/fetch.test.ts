import {describe, it, expect, vi, beforeEach} from 'vitest'
import {$fetch, FetchError} from '../../src/runtime/fetch'

function mockFetch(body: unknown, options: {status?: number; contentType?: string} = {}) {
    const {status = 200, contentType = 'application/json'} = options
    const isJson = contentType.includes('application/json')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(isJson ? JSON.stringify(body) : String(body), {
            status,
            headers: {'Content-Type': contentType},
        })
    )
}

beforeEach(() => vi.restoreAllMocks())

describe('$fetch', () => {
    it('hace GET por defecto', async () => {
        mockFetch({ok: true})
        await $fetch('/api/test')
        expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({method: 'GET'}))
    })

    it('parsea respuesta JSON automáticamente', async () => {
        mockFetch({name: 'John'})
        const result = await $fetch('/api/me')
        expect(result).toEqual({name: 'John'})
    })

    it('serializa body a JSON y setea Content-Type', async () => {
        mockFetch({id: 1}, {status: 201})
        await $fetch('/api/posts', {method: 'POST', body: {title: 'Hola'}})
        expect(fetch).toHaveBeenCalledWith('/api/posts', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({title: 'Hola'}),
        }))
        const headers = (fetch as any).mock.calls[0][1].headers as Headers
        expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('retorna texto si Content-Type no es JSON', async () => {
        mockFetch('pong', {contentType: 'text/plain'})
        const result = await $fetch('/api/ping')
        expect(result).toBe('pong')
    })

    it('propaga headers personalizados', async () => {
        mockFetch({ok: true})
        await $fetch('/api/test', {headers: {'Authorization': 'Bearer token'}})
        const headers = (fetch as any).mock.calls[0][1].headers as Headers
        expect(headers.get('Authorization')).toBe('Bearer token')
    })

    it('lanza FetchError en respuestas no-ok', async () => {
        mockFetch({error: 'Not Found'}, {status: 404})
        await expect($fetch('/api/missing')).rejects.toThrow(FetchError)
    })

    it('FetchError expone status y statusText', async () => {
        mockFetch('Forbidden', {status: 403, contentType: 'text/plain'})
        try {
            await $fetch('/api/secret')
        } catch (e) {
            expect(e).toBeInstanceOf(FetchError)
            expect((e as FetchError).status).toBe(403)
        }
    })

    it('no envía body si no se pasa', async () => {
        mockFetch({ok: true})
        await $fetch('/api/test')
        expect((fetch as any).mock.calls[0][1].body).toBeUndefined()
    })
})
