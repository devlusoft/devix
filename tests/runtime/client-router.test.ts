import {describe, it, expect, vi} from 'vitest'
import {createMatcher} from '../../src/runtime/client-router'

const IndexPage = () => null
const AboutPage = () => null
const BlogPage = () => null
const Layout = () => null

const pageFiles = {
    '/app/pages/index.tsx': vi.fn().mockResolvedValue({default: IndexPage}),
    '/app/pages/about.tsx': vi.fn().mockResolvedValue({default: AboutPage}),
    '/app/pages/blog/[slug].tsx': vi.fn().mockResolvedValue({default: BlogPage}),
}
const layoutFiles = {
    '/app/pages/layout.tsx': vi.fn().mockResolvedValue({default: Layout}),
}

const match = createMatcher(pageFiles, layoutFiles)

describe('createMatcher', () => {
    it('matchea la raíz', () => {
        expect(match('/')?.load).toBe(pageFiles['/app/pages/index.tsx'])
    })
    it('matchea ruta estática', () => {
        expect(match('/about')?.load).toBe(pageFiles['/app/pages/about.tsx'])
    })
    it('matchea ruta dinámica y extrae params', () => {
        const result = match('/blog/hello-world')
        expect(result?.load).toBe(pageFiles['/app/pages/blog/[slug].tsx'])
        expect(result?.params).toEqual({slug: 'hello-world'})
    })
    it('devuelve null para path sin match', () => {
        expect(match('/nonexistent')).toBeNull()
    })
    it('incluye el layout raíz en la cadena', () => {
        const result = match('/')
        expect(result?.loadLayouts).toContain(layoutFiles['/app/pages/layout.tsx'])
    })
})

describe('sorting de rutas', () => {
    it('ruta estática tiene prioridad sobre dinámica', () => {
        const staticPage = () => null
        const dynamicPage = () => null
        const files = {
            '/app/pages/blog/new.tsx': vi.fn().mockResolvedValue({default: staticPage}),
            '/app/pages/blog/[slug].tsx': vi.fn().mockResolvedValue({default: dynamicPage}),
        }
        const m = createMatcher(files, {})
        expect(m('/blog/new')?.load).toBe(files['/app/pages/blog/new.tsx'])
    })

    it('/users/new no es capturado por /users/:id — params queda vacío', () => {
        const files = {
            '/app/pages/users/new.tsx': vi.fn().mockResolvedValue({default: () => null}),
            '/app/pages/users/[id].tsx': vi.fn().mockResolvedValue({default: () => null}),
        }
        const m = createMatcher(files, {})
        const result = m('/users/new')
        expect(result?.load).toBe(files['/app/pages/users/new.tsx'])
        expect(result?.params).toEqual({})
    })

    it('/users/:id sigue matcheando segmentos no estáticos', () => {
        const files = {
            '/app/pages/users/new.tsx': vi.fn().mockResolvedValue({default: () => null}),
            '/app/pages/users/[id].tsx': vi.fn().mockResolvedValue({default: () => null}),
        }
        const m = createMatcher(files, {})
        const result = m('/users/123')
        expect(result?.load).toBe(files['/app/pages/users/[id].tsx'])
        expect(result?.params).toEqual({id: '123'})
    })
})

describe('estabilidad — rutas con mismo número de segmentos', () => {
    it('/users/:id/settings y /users/:id/edit siempre cargan el componente correcto', () => {
        const settingsPage = () => null
        const editPage = () => null
        const files = {
            '/app/pages/users/[id]/settings.tsx': vi.fn().mockResolvedValue({default: settingsPage}),
            '/app/pages/users/[id]/edit.tsx': vi.fn().mockResolvedValue({default: editPage}),
        }
        const m = createMatcher(files, {})
        const navigations = [
            '/users/1/settings', '/users/1/edit', '/users/2/settings', '/users/2/edit',
            '/users/3/settings', '/users/3/edit', '/users/4/settings', '/users/4/edit',
            '/users/5/settings', '/users/5/edit',
        ]
        for (const path of navigations) {
            const result = m(path)
            const expected = path.endsWith('/settings')
                ? files['/app/pages/users/[id]/settings.tsx']
                : files['/app/pages/users/[id]/edit.tsx']
            expect(result?.load, `path ${path}`).toBe(expected)
        }
    })

    it('params.id es correcto en cada navegación alternada', () => {
        const files = {
            '/app/pages/users/[id]/settings.tsx': vi.fn().mockResolvedValue({default: () => null}),
            '/app/pages/users/[id]/edit.tsx': vi.fn().mockResolvedValue({default: () => null}),
        }
        const m = createMatcher(files, {})
        for (let i = 1; i <= 5; i++) {
            expect(m(`/users/${i}/settings`)?.params).toEqual({id: String(i)})
            expect(m(`/users/${i}/edit`)?.params).toEqual({id: String(i)})
        }
    })
})

describe('params', () => {
    it('decodifica URL encoding en params', () => {
        const result = match('/blog/hello%20world')
        expect(result?.params).toEqual({slug: 'hello world'})
    })
})

describe('layout chain', () => {
    it('página sin layout tiene loadLayouts vacío', () => {
        const files = {
            '/app/pages/about.tsx': vi.fn().mockResolvedValue({default: AboutPage}),
        }
        const m = createMatcher(files, {})
        expect(m('/about')?.loadLayouts).toHaveLength(0)
    })

    it('página anidada hereda layouts de toda la cadena', () => {
        const rootLayout = vi.fn()
        const blogLayout = vi.fn()
        const pages = {
            '/app/pages/blog/[slug].tsx': vi.fn().mockResolvedValue({default: BlogPage}),
        }
        const layouts = {
            '/app/pages/layout.tsx': rootLayout,
            '/app/pages/blog/layout.tsx': blogLayout,
        }
        const m = createMatcher(pages, layouts)
        const result = m('/blog/hello')
        expect(result?.loadLayouts).toEqual([rootLayout, blogLayout])
    })
})