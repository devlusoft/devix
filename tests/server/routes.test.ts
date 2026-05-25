import {describe, it, expect, vi} from 'vitest'
import {Hono} from 'hono'
import {PassThrough} from 'node:stream'
import {registerApiRoutes, registerSsrRoute} from '../../src/server/routes'

function makeRenderModule() {
    return {
        render: vi.fn().mockResolvedValue({stream: new PassThrough(), statusCode: 200, headers: {}}),
        runLoader: vi.fn().mockResolvedValue({}),
    }
}

function makeApiModule() {
    return {
        handleApiRequest: vi.fn().mockResolvedValue(new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})),
    }
}

describe('registerSsrRoute', () => {
    it('propaga `server` config a render() para SSR', async () => {
        const app = new Hono()
        const renderModule = makeRenderModule()
        const apiModule = makeApiModule()
        const server = {api: {url: 'http://localhost:8080', allowedPaths: ['/v1/**']}}

        registerSsrRoute(app, {renderModule, apiModule, server})

        await app.request('http://x/page')

        expect(renderModule.render).toHaveBeenCalledOnce()
        const [, , options] = renderModule.render.mock.calls[0]
        expect(options.server).toBe(server)
    })

    it('si no se pasa `server`, render() recibe undefined', async () => {
        const app = new Hono()
        const renderModule = makeRenderModule()
        const apiModule = makeApiModule()

        registerSsrRoute(app, {renderModule, apiModule})

        await app.request('http://x/page')
        const [, , options] = renderModule.render.mock.calls[0]
        expect(options.server).toBeUndefined()
    })

})

describe('registerApiRoutes', () => {
    it('propaga `server` config a handleApiRequest', async () => {
        const app = new Hono()
        const renderModule = makeRenderModule()
        const apiModule = makeApiModule()
        const server = {api: {url: 'http://localhost:8080', allowedPaths: ['/v1/**']}}

        registerApiRoutes(app, {renderModule, apiModule, server})

        await app.request('http://x/api/foo')

        expect(apiModule.handleApiRequest).toHaveBeenCalledOnce()
        const [, , passedServer] = apiModule.handleApiRequest.mock.calls[0]
        expect(passedServer).toBe(server)
    })

    it('propaga `server` config a runLoader en /_data/*', async () => {
        const app = new Hono()
        const renderModule = makeRenderModule()
        const apiModule = makeApiModule()
        const server = {api: {url: 'http://localhost:8080', allowedPaths: ['/v1/**']}}

        registerApiRoutes(app, {renderModule, apiModule, server})

        await app.request('http://x/_devix/data/foo')

        expect(renderModule.runLoader).toHaveBeenCalledOnce()
        const [, , options] = renderModule.runLoader.mock.calls[0]
        expect(options.server).toBe(server)
    })

    it('monta /_devix/server/* solo si hay config de server', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const appWith = new Hono()
        registerApiRoutes(appWith, {renderModule: makeRenderModule(), apiModule: makeApiModule(), server: {api: {url: 'http://x', allowedPaths: ['/v1/**']}}})
        const resWith = await appWith.request('http://x/_devix/server/api/v1/me')
        expect(resWith.status).not.toBe(404)

        const appWithout = new Hono()
        registerApiRoutes(appWithout, {renderModule: makeRenderModule(), apiModule: makeApiModule()})
        const resWithout = await appWithout.request('http://x/_devix/server/api/v1/me')
        expect(resWithout.status).toBe(404)
    })
})
