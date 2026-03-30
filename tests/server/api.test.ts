import {describe, it, expect, vi} from 'vitest'
import {handleApiRequest} from '../../src/server/api'
import {DevixError} from '../../src/runtime/error-boundary'
import type {ApiGlob} from '../../src/server/types'
import type {RouteHandler, MiddlewareModule} from '../../src/runtime/api-context'

const API_DIR = 'app/api'

function makeGlob(
    routes: Record<string, () => Promise<unknown>>,
    middlewares: Record<string, () => Promise<unknown>> = {},
): ApiGlob {
    return {routes, middlewares, apiDir: API_DIR}
}

function req(method: string, path: string, body?: BodyInit): Request {
    return new Request(`http://localhost${path}`, {method, body})
}

describe('handleApiRequest', () => {
    it('returns 404 when no route matches', async () => {
        const glob = makeGlob({
            [`${API_DIR}/users.ts`]: vi.fn().mockResolvedValue({GET: () => new Response('ok')}),
        })
        const res = await handleApiRequest('http://localhost/api/posts', req('GET', '/api/posts'), glob)
        expect(res.status).toBe(404)
    })

    it('returns 405 when method is not defined on module', async () => {
        const glob = makeGlob({
            [`${API_DIR}/users.ts`]: vi.fn().mockResolvedValue({
                GET: async () => new Response('ok'),
            }),
        })
        const res = await handleApiRequest('http://localhost/api/users', req('POST', '/api/users'), glob)
        expect(res.status).toBe(405)
    })

    it('calls GET handler and returns its Response', async () => {
        const handler: RouteHandler = async () => new Response('hello', {status: 200})
        const glob = makeGlob({
            [`${API_DIR}/hello.ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        const res = await handleApiRequest('http://localhost/api/hello', req('GET', '/api/hello'), glob)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('hello')
    })

    it('calls POST handler and returns its Response', async () => {
        const handler: RouteHandler = async () =>
            new Response(JSON.stringify({created: true}), {status: 201})
        const glob = makeGlob({
            [`${API_DIR}/items.ts`]: vi.fn().mockResolvedValue({POST: handler}),
        })
        const res = await handleApiRequest('http://localhost/api/items', req('POST', '/api/items'), glob)
        expect(res.status).toBe(201)
        expect(await res.json()).toEqual({created: true})
    })

    it('passes ctx with params to the handler', async () => {
        let receivedId: string | undefined
        const handler: RouteHandler = async (ctx) => {
            receivedId = ctx.params.id
            return new Response('ok')
        }
        const glob = makeGlob({
            [`${API_DIR}/users/[id].ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        await handleApiRequest('http://localhost/api/users/42', req('GET', '/api/users/42'), glob)
        expect(receivedId).toBe('42')
    })

    it('passes the raw Request as second argument', async () => {
        let receivedRequest: Request | undefined
        const handler: RouteHandler = async (ctx, request) => {
            receivedRequest = request
            return new Response('ok')
        }
        const glob = makeGlob({
            [`${API_DIR}/echo.ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        const request = req('GET', '/api/echo')
        await handleApiRequest('http://localhost/api/echo', request, glob)
        expect(receivedRequest).toBe(request)
    })

    it('auto-converts plain object return to JSON response', async () => {
        const glob = makeGlob({
            [`${API_DIR}/data.ts`]: vi.fn().mockResolvedValue({
                GET: async () => ({name: 'John', age: 30}),
            }),
        })
        const res = await handleApiRequest('http://localhost/api/data', req('GET', '/api/data'), glob)
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('application/json')
        expect(await res.json()).toEqual({name: 'John', age: 30})
    })

    it('auto-converts array return to JSON response', async () => {
        const glob = makeGlob({
            [`${API_DIR}/list.ts`]: vi.fn().mockResolvedValue({
                GET: async () => [{id: 1}, {id: 2}],
            }),
        })
        const res = await handleApiRequest('http://localhost/api/list', req('GET', '/api/list'), glob)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([{id: 1}, {id: 2}])
    })

    it('returns 204 when handler returns null', async () => {
        const glob = makeGlob({
            [`${API_DIR}/empty.ts`]: vi.fn().mockResolvedValue({
                DELETE: async () => null,
            }),
        })
        const res = await handleApiRequest('http://localhost/api/empty', req('DELETE', '/api/empty'), glob)
        expect(res.status).toBe(204)
    })


    it('runs middleware before the handler', async () => {
        const order: string[] = []

        const middleware: MiddlewareModule['middleware'] = async () => {
            order.push('middleware')
            return null
        }
        const handler: RouteHandler = async () => {
            order.push('handler')
            return new Response('ok')
        }

        const glob = makeGlob(
            {[`${API_DIR}/ping.ts`]: vi.fn().mockResolvedValue({GET: handler})},
            {[`${API_DIR}/middleware.ts`]: vi.fn().mockResolvedValue({middleware})},
        )
        await handleApiRequest('http://localhost/api/ping', req('GET', '/api/ping'), glob)
        expect(order).toEqual(['middleware', 'handler'])
    })

    it('middleware can short-circuit and block the handler', async () => {
        const handlerSpy = vi.fn().mockResolvedValue(new Response('should not reach'))
        const middleware: MiddlewareModule['middleware'] = async () =>
            new Response('blocked', {status: 401})

        const glob = makeGlob(
            {[`${API_DIR}/secret.ts`]: vi.fn().mockResolvedValue({GET: handlerSpy})},
            {[`${API_DIR}/middleware.ts`]: vi.fn().mockResolvedValue({middleware})},
        )
        const res = await handleApiRequest('http://localhost/api/secret', req('GET', '/api/secret'), glob)
        expect(res.status).toBe(401)
        expect(handlerSpy).not.toHaveBeenCalled()
    })

    it('returns 500 on unexpected handler error', async () => {
        const glob = makeGlob({
            [`${API_DIR}/boom.ts`]: vi.fn().mockResolvedValue({
                GET: async () => { throw new Error('unexpected') },
            }),
        })
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const res = await handleApiRequest('http://localhost/api/boom', req('GET', '/api/boom'), glob)
        expect(res.status).toBe(500)
    })

    it('returns DevixError status when handler throws DevixError', async () => {
        const glob = makeGlob({
            [`${API_DIR}/guarded.ts`]: vi.fn().mockResolvedValue({
                GET: async () => { throw new DevixError(403, 'Forbidden') },
            }),
        })
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const res = await handleApiRequest('http://localhost/api/guarded', req('GET', '/api/guarded'), glob)
        expect(res.status).toBe(403)
        expect(await res.text()).toBe('Forbidden')
    })

    it('URL-decodes params', async () => {
        let receivedSlug: string | undefined
        const handler: RouteHandler = async (ctx) => {
            receivedSlug = ctx.params.slug
            return new Response('ok')
        }
        const glob = makeGlob({
            [`${API_DIR}/posts/[slug].ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        await handleApiRequest(
            'http://localhost/api/posts/hello%20world',
            req('GET', '/api/posts/hello%20world'),
            glob,
        )
        expect(receivedSlug).toBe('hello world')
    })
})
