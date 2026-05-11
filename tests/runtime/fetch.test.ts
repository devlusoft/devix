import {describe, it, expect, vi, beforeEach} from 'vitest'
import {$fetch} from '../../src/runtime'
import {FetchError} from '../../src/runtime'

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

    it('FetchError.message viene del body cuando tiene .message string', async () => {
        mockFetch({statusCode: 404, message: 'Post no encontrado', code: 'POST_NOT_FOUND'}, {status: 404})
        try {
            await $fetch('/api/posts/x')
        } catch (e) {
            expect(e).toBeInstanceOf(FetchError)
            expect((e as Error).message).toBe('Post no encontrado')
            expect((e as FetchError).code).toBe('POST_NOT_FOUND')
        }
    })

    it('FetchError.message cae a HTTP status si body no tiene .message', async () => {
        mockFetch({something: 'else'}, {status: 500})
        try {
            await $fetch('/api/something')
        } catch (e) {
            expect((e as Error).message).toMatch(/^HTTP 500:/)
            expect((e as FetchError).code).toBeUndefined()
        }
    })

    it('no envía body si no se pasa', async () => {
        mockFetch({ok: true})
        await $fetch('/api/test')
        expect((fetch as any).mock.calls[0][1].body).toBeUndefined()
    })

    it('pasa FormData directamente sin JSON.stringify', async () => {
        mockFetch({ok: true}, {status: 200})
        const form = new FormData()
        form.append('name', 'Luis')
        await $fetch('/api/upload', {method: 'POST', body: form as any})
        const call = (fetch as any).mock.calls[0][1]
        expect(call.body).toBe(form)
    })

    it('no sobreescribe Content-Type al enviar FormData', async () => {
        mockFetch({ok: true})
        const form = new FormData()
        await $fetch('/api/upload', {method: 'POST', body: form as any})
        const headers = (fetch as any).mock.calls[0][1].headers as Headers
        expect(headers.get('Content-Type')).toBeNull()
    })

    it('pasa Blob directamente sin JSON.stringify', async () => {
        mockFetch({ok: true})
        const blob = new Blob(['data'], {type: 'text/plain'})
        await $fetch('/api/upload', {method: 'POST', body: blob as any})
        const call = (fetch as any).mock.calls[0][1]
        expect(call.body).toBe(blob)
    })

    describe('respuesta sin body', () => {
        it('devuelve null en 204 No Content', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
                new Response(null, {status: 204})
            )
            const result = await $fetch('/api/empty')
            expect(result).toBeNull()
        })

        it('devuelve null cuando Content-Length es 0 incluso si Content-Type es JSON', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
                new Response(null, {
                    status: 200,
                    headers: {'Content-Type': 'application/json', 'Content-Length': '0'},
                })
            )
            const result = await $fetch('/api/empty-json')
            expect(result).toBeNull()
        })

        it('FetchError sin body JSON parseable no truena, errorBody queda undefined', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
                new Response('', {
                    status: 500,
                    headers: {'Content-Type': 'application/json'},
                })
            )
            try {
                await $fetch('/api/broken')
                throw new Error('should have thrown')
            } catch (e) {
                expect(e).toBeInstanceOf(FetchError)
                expect((e as FetchError).status).toBe(500)
                expect((e as FetchError<unknown>).body).toBeUndefined()
            }
        })

        it('FetchError en 204 (edge case) no intenta parsear body', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
                new Response(null, {status: 204, headers: {'Content-Type': 'application/json'}})
            )
            const result = await $fetch('/api/empty')
            expect(result).toBeNull()
        })
    })
})
