import {describe, it, expect, vi, beforeEach} from 'vitest'
import {makeBoundServer} from '../../lib/server/server-bound'
import {FetchError} from '../../lib/runtime'
import type {ServerBackendConfig} from '../../lib/config'

beforeEach(() => vi.restoreAllMocks())

function mockBackend(body: unknown, status = 200, ct = 'application/json') {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(body == null ? null : JSON.stringify(body), {
            status,
            headers: ct ? {'Content-Type': ct} : {},
        })
    )
}

describe('makeBoundServer — server-side $server', () => {
    function makeConfig(extra: Partial<ServerBackendConfig> = {}): Record<string, ServerBackendConfig> {
        return {
            api: {url: 'http://backend.local', allowedPaths: ['/v1/**'], ...extra},
        }
    }

    it('hace fetch directo al backend (no via proxy)', async () => {
        mockBackend({user: 'ana'})
        const $server = makeBoundServer(new Request('http://localhost/'), makeConfig())
        const result = await $server.api.get('/v1/me')
        expect(result).toEqual({user: 'ana'})

        const target = (fetch as any).mock.calls[0][0] as URL
        expect(target.href).toBe('http://backend.local/v1/me')
    })

    it('pasa el request del usuario a prepare', async () => {
        mockBackend({ok: true})
        const prepareSpy = vi.fn(({request, headers}: any) => {
            const cookie = request.headers.get('Cookie') ?? ''
            if (cookie.includes('sid=')) headers.set('Authorization', 'Bearer from-cookie')
        })
        const userRequest = new Request('http://localhost/', {
            headers: {Cookie: 'sid=abc123'},
        })
        const $server = makeBoundServer(userRequest, makeConfig({prepare: prepareSpy}))
        await $server.api.get('/v1/me')

        expect(prepareSpy).toHaveBeenCalled()
        const sentHeaders = (fetch as any).mock.calls[0][1].headers as Headers
        expect(sentHeaders.get('Authorization')).toBe('Bearer from-cookie')
    })

    it('respeta allowedPaths — lanza FetchError 403 si no matchea', async () => {
        const $server = makeBoundServer(new Request('http://localhost/'), makeConfig())
        try {
            await $server.api.get('/v2/secret')
            throw new Error('should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(FetchError)
            expect((e as FetchError).status).toBe(403)
            expect((e as FetchError).code).toBe('PATH_NOT_ALLOWED')
        }
    })

    it('respeta deniedPaths', async () => {
        const cfg = makeConfig({deniedPaths: ['/v1/admin/**']})
        const $server = makeBoundServer(new Request('http://localhost/'), cfg)
        try {
            await $server.api.get('/v1/admin/users')
            throw new Error('should have thrown')
        } catch (e) {
            expect((e as FetchError).code).toBe('PATH_DENIED')
        }
    })

    it('lanza con error informativo si namespace no existe', () => {
        const $server = makeBoundServer(new Request('http://localhost/'), {})
        expect(() => $server.unknown).toThrow(/namespace "unknown" not configured/)
    })

    it('lanza con error informativo si no hay server config', () => {
        const $server = makeBoundServer(new Request('http://localhost/'), undefined)
        expect(() => $server.api).toThrow(/no 'server' config is defined/)
    })

    it('reutiliza el mismo client por namespace', () => {
        const $server = makeBoundServer(new Request('http://localhost/'), makeConfig())
        const a = $server.api
        const b = $server.api
        expect(a).toBe(b)
    })

    it('prepare retornando Response lanza FetchError con ese status', async () => {
        const $server = makeBoundServer(new Request('http://localhost/'), makeConfig({
            prepare: () => new Response(JSON.stringify({statusCode: 401, message: 'No auth'}), {
                status: 401,
                headers: {'Content-Type': 'application/json'},
            }),
        }))
        try {
            await $server.api.get('/v1/me')
            throw new Error('should have thrown')
        } catch (e) {
            expect((e as FetchError).status).toBe(401)
        }
    })

    it('POST serializa body a JSON', async () => {
        mockBackend({id: 1})
        const $server = makeBoundServer(new Request('http://localhost/'), makeConfig())
        await $server.api.post('/v1/posts', {title: 'Hola'})

        const call = (fetch as any).mock.calls[0]
        expect(call[1].method).toBe('POST')
        expect(call[1].body).toBe(JSON.stringify({title: 'Hola'}))
    })

    it('respuesta no-ok lanza FetchError con body parseado', async () => {
        mockBackend({statusCode: 404, message: 'Not found', code: 'NOT_FOUND'}, 404)
        const $server = makeBoundServer(new Request('http://localhost/'), makeConfig())
        try {
            await $server.api.get('/v1/missing')
            throw new Error('should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(FetchError)
            expect((e as FetchError).code).toBe('NOT_FOUND')
            expect((e as FetchError).message).toBe('Not found')
        }
    })
})
