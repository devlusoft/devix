import {describe, it, expect, vi} from 'vitest'
import {render, runLoader} from '../../src/server/render'
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

describe('guardData — guard pasa datos al loader', () => {
    it('el loader recibe guardData desde el guard de la página', async () => {
        let received: unknown
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                guard: async () => ({user: 'ana'}),
                loader: async ({guardData}: any) => { received = guardData; return null },
            }),
        })
        await runLoader('http://localhost/', req, glob)
        expect(received).toEqual({user: 'ana'})
    })

    it('el loader recibe guardData desde el guard del layout', async () => {
        let received: unknown
        const glob = makeGlob(
            {
                [`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry({
                    loader: async ({guardData}: any) => { received = guardData; return null },
                }),
            },
            {
                [`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({
                    guard: async () => ({session: 'token-123'}),
                }),
            },
        )
        await runLoader('http://localhost/dashboard', req, glob)
        expect(received).toEqual({session: 'token-123'})
    })

    it('guardData del guard de página sobreescribe el del layout si ambos retornan datos', async () => {
        let received: unknown
        const glob = makeGlob(
            {
                [`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry({
                    guard: async () => ({from: 'page'}),
                    loader: async ({guardData}: any) => { received = guardData; return null },
                }),
            },
            {
                [`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({
                    guard: async () => ({from: 'layout'}),
                }),
            },
        )
        await runLoader('http://localhost/dashboard', req, glob)
        expect(received).toEqual({from: 'page'})
    })

    it('guardData es undefined cuando el guard retorna null', async () => {
        let received: unknown = 'sentinel'
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                guard: async () => null,
                loader: async ({guardData}: any) => { received = guardData; return null },
            }),
        })
        await runLoader('http://localhost/', req, glob)
        expect(received).toBeUndefined()
    })
})

describe('loader sin return (void)', () => {
    it('loaderData es undefined cuando el loader no retorna nada', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                loader: async () => { /* sin return */ },
            }),
        })
        const result = await runLoader('http://localhost/', req, glob)
        expect(result.loaderData).toBeUndefined()
    })

    it('renderiza correctamente con loader void', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({
                loader: async () => { /* sin return */ },
            }),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(200)
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

    it('redirect con status 307 desde loader de página', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => redirect('/home', 307)}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(307)
        expect(result.headers).toMatchObject({Location: '/home'})
    })

    it('redirect con status 308 desde loader de layout', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({loader: async () => redirect('/login', 308)})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(308)
        expect(result.headers).toMatchObject({Location: '/login'})
    })

    it('redirect por string desde guard siempre usa 302', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({guard: async () => '/login'}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(302)
    })
})

describe('redirect() desde loader', () => {
    it('loader de página puede redirigir con redirect()', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => redirect('/home')}),
        })
        const result = await render('http://localhost/', req, glob)
        expect(result.statusCode).toBe(302)
        expect(result.headers).toMatchObject({Location: '/home'})
    })

    it('loader de layout puede redirigir con redirect()', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({loader: async () => redirect('/login')})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(302)
        expect(result.headers).toMatchObject({Location: '/login'})
    })

    it('loader de página puede redirigir en runLoader', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: pageEntry({loader: async () => redirect('/home')}),
        })
        const result = await runLoader('http://localhost/', req, glob)
        expect(result).toMatchObject({redirect: '/home', redirectStatus: 302})
    })
})

describe('layout loader sin return (void)', () => {
    it('layoutsData tiene null cuando el layout loader no retorna nada', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({loader: async () => { /* void */ }})},
        )
        const result = await runLoader('http://localhost/dashboard', req, glob)
        expect(result.layouts![0].loaderData).toBeUndefined()
    })

    it('renderiza correctamente con layout loader void', async () => {
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {[`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({loader: async () => { /* void */ }})},
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(200)
    })
})

describe('guardData — guard retorna null no borra guardData previo', () => {
    it('guardData del layout se mantiene si el guard de la página retorna null', async () => {
        let received: unknown
        const glob = makeGlob(
            {
                [`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry({
                    guard: async () => null,
                    loader: async ({guardData}: any) => { received = guardData; return null },
                }),
            },
            {
                [`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({
                    guard: async () => ({session: 'abc'}),
                }),
            },
        )
        await runLoader('http://localhost/dashboard', req, glob)
        expect(received).toEqual({session: 'abc'})
    })
})

describe('generateLang recibe loaderData del layout raíz', () => {
    it('generateLang del layout raíz recibe su propio loaderData', async () => {
        let receivedLoaderData: unknown
        const glob = makeGlob(
            {[`${PAGES_DIR}/dashboard/index.tsx`]: pageEntry()},
            {
                [`${PAGES_DIR}/dashboard/layout.tsx`]: layoutEntry({
                    loader: async () => ({locale: 'es'}),
                    generateLang: async ({loaderData}: any) => {
                        receivedLoaderData = loaderData
                        return loaderData.locale
                    },
                }),
            },
        )
        const result = await render('http://localhost/dashboard', req, glob)
        expect(result.statusCode).toBe(200)
        expect(receivedLoaderData).toEqual({locale: 'es'})
        expect(result.html).toContain('lang="es"')
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
