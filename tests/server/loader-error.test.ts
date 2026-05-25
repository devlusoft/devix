import {describe, it, expect, vi} from 'vitest'
import {PassThrough, Readable} from 'node:stream'

vi.mock('solid-js/web', async (importOriginal) => {
    const mod: any = await importOriginal()
    return {
        ...mod,
        renderToStream: (fn: () => any) => {
            const stream = new PassThrough()
            const html = mod.renderToString(fn)
            stream.end(html)
            return stream
        }
    }
})

import {render as _render, runLoader} from '../../src/server/render'
import {error} from '../../src/utils/response'
import type {PageGlob} from '../../src/server/types'

async function render(url: string, request: Request, glob: PageGlob, options?: any) {
    const result = await _render(url, request, glob, options)
    const webStream = Readable.toWeb(result.stream) as ReadableStream
    const html = await new Response(webStream).text()
    return {html, statusCode: result.statusCode, headers: result.headers}
}

const PAGES_DIR = 'app/pages'
const req = new Request('http://localhost/test')

function makeGlob(
    pages: Record<string, () => Promise<unknown>>,
    layouts: Record<string, () => Promise<unknown>> = {},
): PageGlob {
    return {pages, layouts, pagesDir: PAGES_DIR}
}

function pageEntry(overrides: Record<string, unknown> = {}) {
    return vi.fn().mockResolvedValue({default: () => null, ...overrides})
}

function layoutEntry(overrides: Record<string, unknown> = {}) {
    return vi.fn().mockResolvedValue({default: ({children}: any) => children, ...overrides})
}

describe('error() en guard de página', () => {
    it('runLoader retorna loaderError desde el guard de página', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => error(401, 'Unauthorized')}),
        })
        const result = await runLoader('http://localhost/', req, glob)
        expect(result).toMatchObject({loaderError: {statusCode: 401, message: 'Unauthorized'}})
    })

    it('render retorna el statusCode del error del guard', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => error(403, 'Forbidden')}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(403)
    })
})

describe('error() en guard de layout', () => {
    it('runLoader retorna loaderError desde el guard del layout', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({guard: async () => error(401, 'Session expired')})},
        )
        const result = await runLoader('http://localhost/dashboard', req, glob)
        expect(result).toMatchObject({loaderError: {statusCode: 401, message: 'Session expired'}})
    })

    it('el guard de la página no se ejecuta si el guard del layout retorna error()', async () => {
        const pageGuard = vi.fn().mockResolvedValue(null)
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry({guard: pageGuard})},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({guard: async () => error(403, 'Forbidden')})},
        )
        await runLoader('http://localhost/dashboard', req, glob)
        expect(pageGuard).not.toHaveBeenCalled()
    })
})
