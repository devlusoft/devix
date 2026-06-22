import {describe, it, expect, vi, beforeEach} from 'vitest'
import {handleProxyRequest, parseProxyPath} from '../../lib/server/server-proxy'
import type {ServerBackendConfig} from '../../lib/config'

describe('parseProxyPath', () => {
    it('parsea namespace y path', () => {
        expect(parseProxyPath('/_devix/server/api/v1/me'))
            .toEqual({namespace: 'api', path: '/v1/me'})
        expect(parseProxyPath('/_devix/server/stripe/v1/customers/123'))
            .toEqual({namespace: 'stripe', path: '/v1/customers/123'})
    })

    it('namespace solo (sin path) → path "/"', () => {
        expect(parseProxyPath('/_devix/server/api'))
            .toEqual({namespace: 'api', path: '/'})
    })

    it('retorna null si no es path de proxy', () => {
        expect(parseProxyPath('/api/v1/me')).toBeNull()
        expect(parseProxyPath('/')).toBeNull()
        expect(parseProxyPath('/_devix/server')).toBeNull()
    })
})

describe('handleProxyRequest', () => {
    beforeEach(() => vi.restoreAllMocks())

    function makeConfig(extra: Partial<ServerBackendConfig> = {}): Record<string, ServerBackendConfig> {
        return {
            api: {
                url: 'http://backend.local',
                allowedPaths: ['/v1/**'],
                ...extra,
            },
        }
    }

    function mockBackend(body: unknown, status = 200, headers: HeadersInit = {'Content-Type': 'application/json'}) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify(body), {status, headers})
        )
    }

    it('reenvía request al backend cuando matchea allowedPaths', async () => {
        mockBackend({user: 'ana'})
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig(),
        )
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({user: 'ana'})

        expect(fetch).toHaveBeenCalledWith(
            expect.objectContaining({href: 'http://backend.local/v1/me'}),
            expect.objectContaining({method: 'GET'}),
        )
    })

    it('responde 404 cuando el namespace no está configurado', async () => {
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/unknown/v1/me'),
            makeConfig(),
        )
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.code).toBe('BACKEND_NOT_FOUND')
    })

    it('responde 403 cuando el path no matchea allowedPaths', async () => {
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v2/secret'),
            makeConfig(),
        )
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.code).toBe('PATH_NOT_ALLOWED')
    })

    it('responde 403 cuando no hay allowedPaths configurado (deny-all)', async () => {
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            {api: {url: 'http://backend.local'}},
        )
        expect(res.status).toBe(403)
    })

    it('responde 403 cuando el path está en deniedPaths', async () => {
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/admin/secret'),
            {api: {
                url: 'http://backend.local',
                allowedPaths: ['/v1/**'],
                deniedPaths: ['/v1/admin/**'],
            }},
        )
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.code).toBe('PATH_DENIED')
    })

    it('ejecuta prepare antes de fetchear', async () => {
        mockBackend({ok: true})
        const prepareSpy = vi.fn(({headers}: any) => {
            headers.set('Authorization', 'Bearer test-token')
        })
        await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig({prepare: prepareSpy}),
        )
        expect(prepareSpy).toHaveBeenCalled()
        const fetchHeaders = (fetch as any).mock.calls[0][1].headers as Headers
        expect(fetchHeaders.get('Authorization')).toBe('Bearer test-token')
    })

    it('prepare puede retornar Response para cortar', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig({
                prepare: () => new Response('Unauthorized', {status: 401}),
            }),
        )
        expect(res.status).toBe(401)
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('prepare async se espera correctamente', async () => {
        mockBackend({ok: true})
        await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig({
                prepare: async ({headers}) => {
                    await new Promise(r => setTimeout(r, 5))
                    headers.set('X-Async', '1')
                },
            }),
        )
        const fetchHeaders = (fetch as any).mock.calls[0][1].headers as Headers
        expect(fetchHeaders.get('X-Async')).toBe('1')
    })

    it('errores en prepare devuelven 500 con código PREPARE_ERROR', async () => {
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig({
                prepare: () => { throw new Error('boom') },
            }),
        )
        expect(res.status).toBe(500)
        const body = await res.json()
        expect(body.code).toBe('PREPARE_ERROR')
    })

    it('reenvía body en POST', async () => {
        mockBackend({created: true})
        await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/posts', {
                method: 'POST',
                body: JSON.stringify({title: 'Hola'}),
                headers: {'Content-Type': 'application/json'},
            }),
            makeConfig(),
        )
        const call = (fetch as any).mock.calls[0]
        expect(call[1].method).toBe('POST')
        const sentBody = call[1].body
        expect(new TextDecoder().decode(sentBody)).toContain('"title":"Hola"')
    })

    it('preserva query string al reenviar', async () => {
        mockBackend({results: []})
        await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/search?q=foo&page=2'),
            makeConfig(),
        )
        const target = (fetch as any).mock.calls[0][0] as URL
        expect(target.search).toBe('?q=foo&page=2')
    })

    it('error de fetch al backend devuelve 502', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'))
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig(),
        )
        expect(res.status).toBe(502)
        const body = await res.json()
        expect(body.code).toBe('BACKEND_UNREACHABLE')
    })

    it('filtra headers hop-by-hop de la respuesta del backend', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response('{}', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                    'Transfer-Encoding': 'chunked',
                    'X-Custom': 'keep',
                },
            })
        )
        const res = await handleProxyRequest(
            new Request('http://localhost/_devix/server/api/v1/me'),
            makeConfig(),
        )
        expect(res.headers.get('Content-Type')).toBe('application/json')
        expect(res.headers.get('X-Custom')).toBe('keep')
        expect(res.headers.get('Connection')).toBeNull()
        expect(res.headers.get('Transfer-Encoding')).toBeNull()
    })
})
