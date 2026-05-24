import {describe, it, expect, vi} from 'vitest'
import {render} from '../../src/server/render'
import {redirect} from '../../src/utils/response'
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

describe('guard en página', () => {
    it('redirige cuando guard retorna string', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => '/login'}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(302)
        expect(result.headers).toMatchObject({Location: '/login'})
    })

    it('renderiza cuando guard retorna null', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => null}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(200)
    })

    it('renderiza cuando no hay guard', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry(),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(200)
    })
})

describe('guard en layout', () => {
    it('redirige cuando el guard del layout retorna string', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({guard: async () => '/login'})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(302)
        expect(result.headers).toMatchObject({Location: '/login'})
    })

    it('renderiza cuando el guard del layout retorna null', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({guard: async () => null})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(200)
    })

    it('el guard del layout corre antes que el de la página', async () => {
        const order: string[] = []
        const glob = makeGlob(
            {
                [`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry({
                    guard: async () => { order.push('page'); return null },
                }),
            },
            {
                [`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({
                    guard: async () => { order.push('layout'); return null },
                }),
            },
        )
        await render('http://localhost/dashboard', req, glob)
        expect(order).toEqual(['layout', 'page'])
    })

    it('el guard del layout corta antes de llegar al guard de la página', async () => {
        const pageGuard = vi.fn().mockResolvedValue(null)
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry({guard: pageGuard})},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({guard: async () => '/login'})},
        )
        await render('http://localhost/dashboard', req, glob)
        expect(pageGuard).not.toHaveBeenCalled()
    })
})

describe('redirect() desde guard', () => {
    it('guard de página puede redirigir con redirect()', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => redirect('/login')}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(302)
        expect(result.headers).toMatchObject({Location: '/login'})
    })

    it('guard de layout puede redirigir con redirect() y respeta status 301', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({guard: async () => redirect('/login', 301)})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(301)
        expect(result.headers).toMatchObject({Location: '/login'})
    })
})

describe('redirect() respeta el status code', () => {
    it('redirect con status 301 desde guard de página', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => redirect('/home', 301)}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(301)
        expect(result.headers).toMatchObject({Location: '/home'})
    })

    it('redirect por string desde guard siempre usa 302', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => '/login'}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(302)
    })
})

describe('404', () => {
    it('retorna 404 cuando la ruta no existe', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry(),
        })
        const result = await render('http://localhost/no-existe', req, glob)
        expect(result.statusCode).toBe(404)
    })
})
