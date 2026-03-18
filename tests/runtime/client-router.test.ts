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