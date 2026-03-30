import {describe, it, expect, vi} from 'vitest'
import {render, runLoader} from '../../src/server/render'
import {error} from '../../src/utils/response'
import type {PageGlob} from '../../src/server/types'

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

describe('error() en loader de página', () => {
    it('runLoader retorna loaderError con el statusCode correcto', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => error(401, 'Unauthorized')}),
        })
        const result = await runLoader('http://localhost/', req, glob)
        expect(result).toMatchObject({loaderError: {statusCode: 401, message: 'Unauthorized'}})
    })

    it('render retorna el statusCode del error', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => error(403, 'Forbidden')}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(403)
    })

    it('render incluye window.__LOADER_ERROR__ en el HTML', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                loader: async () => error(401, 'Unauthorized', {reason: 'token_expired'}),
            }),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.html).toContain('__LOADER_ERROR__')
        expect(result.html).toContain('"statusCode":401')
        expect(result.html).toContain('"message":"Unauthorized"')
        expect(result.html).toContain('"reason":"token_expired"')
    })

    it('render incluye window.__DEVIX__ junto con __LOADER_ERROR__', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => error(401, 'Unauthorized')}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.html).toContain('window.__DEVIX__')
        expect(result.html).not.toMatch(/window\.__DEVIX__=null/)
    })

    it('error sin data funciona correctamente', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => error(500, 'Internal error')}),
        })
        const result = await runLoader('http://localhost/', req, glob)
        expect(result).toMatchObject({loaderError: {statusCode: 500, message: 'Internal error'}})
        expect((result as any).loaderError.data).toBeUndefined()
    })
})

describe('error() en loader de layout', () => {
    it('runLoader retorna loaderError desde el layout loader', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({loader: async () => error(403, 'Forbidden')})},
        )
        const result = await runLoader('http://localhost/dashboard', req, glob)
        expect(result).toMatchObject({loaderError: {statusCode: 403, message: 'Forbidden'}})
    })

    it('render retorna el statusCode del error del layout', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({loader: async () => error(401, 'Unauthorized')})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(401)
    })
})

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

    it('el loader no se ejecuta si el guard retorna error()', async () => {
        const loader = vi.fn().mockResolvedValue({user: 'John'})
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                guard: async () => error(401, 'Unauthorized'),
                loader,
            }),
        })
        await runLoader('http://localhost/', req, glob)
        expect(loader).not.toHaveBeenCalled()
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

describe('error() con data estructurada', () => {
    it('el data llega en el loaderError', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                loader: async () => error(422, 'Validation error', {fields: {email: 'Invalid format'}}),
            }),
        })
        const result = await runLoader('http://localhost/', req, glob) as any
        expect(result.loaderError.data).toEqual({fields: {email: 'Invalid format'}})
    })

    it('render incluye el data en el HTML', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                loader: async () => error(422, 'Validation error', {fields: {email: 'Invalid format'}}),
            }),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.html).toContain('"fields"')
        expect(result.html).toContain('Invalid format')
    })
})

describe('error() no interfiere con casos normales', () => {
    it('loader que retorna datos normales no es afectado', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => ({user: 'John'})}),
        })
        const result = await runLoader('http://localhost/', req, glob) as any
        expect(result.loaderData).toEqual({user: 'John'})
        expect('loaderError' in result).toBe(false)
    })

    it('guard que retorna null sigue al loader normalmente', async () => {
        const loader = vi.fn().mockResolvedValue({user: 'John'})
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                guard: async () => null,
                loader,
            }),
        })
        await runLoader('http://localhost/', req, glob)
        expect(loader).toHaveBeenCalledOnce()
    })
})