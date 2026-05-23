import {describe, it, expect, vi} from 'vitest'

describe('render', () => {
    it('wrappea la página dentro del layout', async () => {
        const {render} = await import('../../src/server/render')

        const glob = {
            pagesDir: 'app/pages',
            pages: {
                'app/pages/index.tsx': () => Promise.resolve({
                    default: () => <main>Page</main>
                })
            },
            layouts: {
                'app/pages/layout.tsx': () => Promise.resolve({
                    default: ({children}: any) => <div id="layout">{children}</div>
                })
            }
        }

        const {statusCode} = await render('http://localhost/', new Request('http://localhost/'), glob as any)

        expect(statusCode).toBe(200)
    })

    it('retorna 404 si no hay página', async () => {
        const {render} = await import('../../src/server/render')

        const glob = {
            pagesDir: 'app/pages',
            pages: {},
            layouts: {}
        }

        const {statusCode} = await render('http://localhost/nonexistent', new Request('http://localhost/nonexistent'), glob as any)
        expect(statusCode).toBe(404)
    })

    it('retorna redirect si el guard lo indica', async () => {
        const {render} = await import('../../src/server/render')

        const glob = {
            pagesDir: 'app/pages',
            pages: {
                'app/pages/index.tsx': () => Promise.resolve({
                    default: () => <main>Page</main>,
                    guard: async () => '/login'
                })
            },
            layouts: {}
        }

        const {statusCode, headers} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
        expect(statusCode).toBe(302)
        expect(headers).toMatchObject({Location: '/login'})
    })
})

it('incluye metadata en el head', async () => {
    const {render} = await import('../../src/server/render')

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: () => <main>Page</main>,
                metadata: {title: 'Home', description: 'My site'}
            })
        },
        layouts: {}
    }

    const {html} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    const match = html.match(/window\.__DEVIX__=({.*?});/)
    const data = JSON.parse(match![1])
    expect(data.metadata.title).toBe('Home')
    expect(data.metadata.description).toBe('My site')
})

it('usa el lang del layout raíz', async () => {
    const {render} = await import('../../src/server/render')

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: () => <main>Page</main>
            })
        },
        layouts: {
            'app/pages/layout.tsx': () => Promise.resolve({
                default: ({children}: any) => <div>{children}</div>,
                lang: 'es'
            })
        }
    }

    const {html} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(html).toContain('lang="es"')
})

it('usa generateLang dinámico del layout raíz', async () => {
    const {render} = await import('../../src/server/render')

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: () => <main>Page</main>
            })
        },
        layouts: {
            'app/pages/layout.tsx': () => Promise.resolve({
                default: ({children}: any) => <div>{children}</div>,
                generateLang: async () => 'fr'
            })
        }
    }

    const {html} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(html).toContain('lang="fr"')
})

it('metadata de página sobreescribe metadata del layout', async () => {
    const {render} = await import('../../src/server/render')

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: () => <main>Page</main>,
                metadata: {title: 'Page Title'}
            })
        },
        layouts: {
            'app/pages/layout.tsx': () => Promise.resolve({
                default: ({children}: any) => <div>{children}</div>,
                metadata: {title: 'Layout Title', description: 'Layout desc'}
            })
        }
    }

    const {html} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    const match = html.match(/window\.__DEVIX__=({.*?});/)
    const data = JSON.parse(match![1])
    expect(data.metadata.title).toBe('Page Title')
    expect(data.metadata.description).toBe('Layout desc')
})

it('lang por defecto es "en" si no hay layout', async () => {
    const {render} = await import('../../src/server/render')

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: () => <main>Page</main>
            })
        },
        layouts: {}
    }

    const {html} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(html).toContain('lang="en"')
})

it('llama al loader y pasa los datos a la página', async () => {
    const {render} = await import('../../src/server/render')
    const loader = vi.fn().mockResolvedValue({user: 'John'})

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: () => <main>Page</main>,
                loader
            })
        },
        layouts: {}
    }

    const {html} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(loader).toHaveBeenCalledOnce()
    expect(html).toContain('__DEVIX_TURBO__')

    const b64 = html.match(/__DEVIX_TURBO__=("?)([A-Za-z0-9+/=]+)\1/)?.[2]
    expect(b64).toBeTruthy()
    const turboStr = Buffer.from(b64!, 'base64').toString('utf-8')
    expect(turboStr).toContain('"user":"John"')
})

it('el guard recibe params correctamente', async () => {
    const {render} = await import('../../src/server/render')
    const guard = vi.fn().mockResolvedValue(null)

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/blog/[slug].tsx': () => Promise.resolve({
                default: () => <main>Post</main>,
                guard
            })
        },
        layouts: {}
    }

    await render('http://localhost/blog/hello', new Request('http://localhost/blog/hello'), glob as any)
    expect(guard).toHaveBeenCalledWith(
        expect.objectContaining({params: {slug: 'hello'}})
    )
})

it('el guard bloquea el render si retorna redirect', async () => {
    const {render} = await import('../../src/server/render')
    const pageDefault = vi.fn()

    const glob = {
        pagesDir: 'app/pages',
        pages: {
            'app/pages/index.tsx': () => Promise.resolve({
                default: pageDefault,
                guard: async () => '/login'
            })
        },
        layouts: {}
    }

    const {statusCode} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(statusCode).toBe(302)
    expect(pageDefault).not.toHaveBeenCalled()
})