import {describe, it, expect, vi} from 'vitest'

vi.mock('solid-js/web', async (importOriginal) => {
    const mod: any = await importOriginal()
    return {
        ...mod,
        renderToStream: (fn: () => any) => {
            const tempDiv = document.createElement('div')
            const dispose = mod.render(fn, tempDiv)
            const html = tempDiv.innerHTML
            dispose()
            return {
                pipeTo: (writable: WritableStream) => {
                    const encoder = new TextEncoder()
                    const writer = writable.getWriter()
                    writer.write(encoder.encode(html))
                    writer.close()
                }
            }
        }
    }
})

import {render as _render} from '../../src/server/render'

async function render(url: string, request: Request, glob: any, options?: any) {
    const result = await _render(url, request, glob, options)
    const html = await new Response(result.stream).text()
    return {html, statusCode: result.statusCode, headers: result.headers}
}

describe('render', () => {
    it('wrappea la página dentro del layout', async () => {
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
        const glob = {
            pagesDir: 'app/pages',
            pages: {},
            layouts: {}
        }

        const {statusCode} = await render('http://localhost/nonexistent', new Request('http://localhost/nonexistent'), glob as any)
        expect(statusCode).toBe(404)
    })

    it('retorna redirect si el guard lo indica', async () => {
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

    const {statusCode} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(statusCode).toBe(200)
})

it('usa el lang del layout raíz', async () => {
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

    const {statusCode} = await render('http://localhost/', new Request('http://localhost/'), glob as any)
    expect(statusCode).toBe(200)
})

it('lang por defecto es "en" si no hay layout', async () => {
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

it('el guard recibe params correctamente', async () => {
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