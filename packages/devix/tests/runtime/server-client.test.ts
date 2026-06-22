import {describe, it, expect, vi, beforeEach} from 'vitest'
import {$server, FetchError} from '../../lib/runtime'

function mockBackend(body: unknown, status = 200, ct = 'application/json') {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(body == null ? null : JSON.stringify(body), {
            status,
            headers: ct ? {'Content-Type': ct} : {},
        })
    )
}

beforeEach(() => vi.restoreAllMocks())

describe('$server — namespaces y métodos', () => {
    it('GET reenvía al path del proxy con el namespace', async () => {
        mockBackend({user: 'ana'})
        const res = await $server.api.get('/v1/me')
        expect(res).toEqual({user: 'ana'})
        expect(fetch).toHaveBeenCalledWith(
            '/_devix/server/api/v1/me',
            expect.objectContaining({method: 'GET'}),
        )
    })

    it('POST serializa body a JSON', async () => {
        mockBackend({id: 1})
        await $server.api.post('/v1/posts', {title: 'Hola'})
        const call = (fetch as any).mock.calls[0]
        expect(call[0]).toBe('/_devix/server/api/v1/posts')
        expect(call[1].method).toBe('POST')
        expect(call[1].body).toBe(JSON.stringify({title: 'Hola'}))
        expect((call[1].headers as Headers).get('Content-Type')).toBe('application/json')
    })

    it('PUT y PATCH funcionan igual', async () => {
        mockBackend({})
        await $server.api.put('/v1/users/1', {name: 'x'})
        expect((fetch as any).mock.calls[0][1].method).toBe('PUT')

        mockBackend({})
        await $server.api.patch('/v1/users/1', {name: 'y'})
        expect((fetch as any).mock.calls[1][1].method).toBe('PATCH')
    })

    it('DELETE no envía body', async () => {
        mockBackend(null, 204)
        const res = await $server.api.delete('/v1/users/1')
        expect(res).toBeNull()
        expect((fetch as any).mock.calls[0][1].body).toBeUndefined()
    })

    it('namespaces distintos generan paths distintos', async () => {
        mockBackend({})
        await $server.api.get('/v1/me')
        mockBackend({})
        await $server.stripe.get('/v1/customers')

        expect((fetch as any).mock.calls[0][0]).toBe('/_devix/server/api/v1/me')
        expect((fetch as any).mock.calls[1][0]).toBe('/_devix/server/stripe/v1/customers')
    })

    it('reutiliza el mismo client por namespace (cached)', () => {
        const a = $server.api
        const b = $server.api
        expect(a).toBe(b)
    })

    it('respuesta no-ok lanza FetchError con shape ErrorBody', async () => {
        mockBackend({statusCode: 404, message: 'Not found', code: 'NOT_FOUND'}, 404)
        try {
            await $server.api.get('/v1/missing')
            throw new Error('should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(FetchError)
            expect((e as FetchError).status).toBe(404)
            expect((e as FetchError).message).toBe('Not found')
            expect((e as FetchError).code).toBe('NOT_FOUND')
        }
    })

    it('204 devuelve null sin intentar parsear', async () => {
        mockBackend(null, 204, '')
        const res = await $server.api.delete('/v1/users/1')
        expect(res).toBeNull()
    })

    it('FormData se pasa directo sin JSON.stringify', async () => {
        mockBackend({ok: true})
        const form = new FormData()
        form.append('name', 'Luis')
        await $server.api.post('/v1/upload', form as any)
        const call = (fetch as any).mock.calls[0]
        expect(call[1].body).toBe(form)
        expect((call[1].headers as Headers).get('Content-Type')).toBeNull()
    })

    it('propaga headers personalizados', async () => {
        mockBackend({})
        await $server.api.get('/v1/me', {headers: {'X-Custom': 'value'}})
        const h = (fetch as any).mock.calls[0][1].headers as Headers
        expect(h.get('X-Custom')).toBe('value')
    })

    it('AbortSignal se propaga', async () => {
        mockBackend({})
        const controller = new AbortController()
        await $server.api.get('/v1/me', {signal: controller.signal})
        expect((fetch as any).mock.calls[0][1].signal).toBe(controller.signal)
    })
})
