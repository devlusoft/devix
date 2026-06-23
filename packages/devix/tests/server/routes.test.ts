import {describe, it, expect, vi} from 'vitest'
import {Hono} from 'hono'
import {PassThrough} from 'node:stream'
import {registerSsrRoute} from '../../lib/server/routes'

function makeRenderModule() {
    return {
        renderStream: vi.fn().mockResolvedValue({stream: new PassThrough(), statusCode: 200, headers: {}}),
        runLoader: vi.fn().mockResolvedValue({}),
    }
}

describe('registerSsrRoute', () => {
    it('propaga loaderTimeout a renderStream()', async () => {
        const app = new Hono()
        const renderModule = makeRenderModule()

        registerSsrRoute(app, {renderModule, apiModule: {handleApiRequest: vi.fn()}, loaderTimeout: 5000})

        await app.request('http://x/page')
        const [, , options] = renderModule.renderStream.mock.calls[0]
        expect(options.loaderTimeout).toBe(5000)
    })
})
