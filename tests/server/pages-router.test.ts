import {describe, it, expect, beforeEach} from 'vitest'
import {buildPages, matchPage} from '../../src/server'
import {invalidatePagesCache} from '../../src/server/pages-router'

beforeEach(() => {
    invalidatePagesCache()
})

const PAGES_DIR = 'app/pages'

function makeKeys(files: string[]) {
    return files.map(f => `${PAGES_DIR}/${f}`)
}

describe('buildPages', () => {
    it('escanea index page como /', () => {
        const {pages} = buildPages(makeKeys(['index.tsx']), [], PAGES_DIR)
        expect(pages[0].path).toBe('/')
    })

    it('detecta rutas estáticas y dinámicas', () => {
        const {pages} = buildPages(makeKeys(['about.tsx', 'blog/[slug].tsx']), [], PAGES_DIR)
        const paths = pages.map(p => p.path)
        expect(paths).toContain('/about')
        expect(paths).toContain('/blog/:slug')
    })

    it('ordena rutas estáticas antes que dinámicas', () => {
        const {pages} = buildPages(makeKeys(['blog/[slug].tsx', 'blog/new.tsx']), [], PAGES_DIR)
        const paths = pages.map(p => p.path)
        expect(paths.indexOf('/blog/new')).toBeLessThan(paths.indexOf('/blog/:slug'))
    })

    it('separa layouts de páginas', () => {
        const {pages, layouts} = buildPages(
            makeKeys(['index.tsx']),
            makeKeys(['layout.tsx']),
            PAGES_DIR
        )
        expect(pages).toHaveLength(1)
        expect(layouts).toHaveLength(1)
    })

    it('extrae nombres de params', () => {
        const {pages} = buildPages(makeKeys(['[id]/edit.tsx']), [], PAGES_DIR)
        expect(pages[0].params).toEqual(['id'])
    })
})

describe('matchPage', () => {
    let pages: ReturnType<typeof buildPages>['pages']

    beforeEach(() => {
        const result = buildPages(
            makeKeys(['index.tsx', 'about.tsx', 'blog/[slug].tsx']),
            [],
            PAGES_DIR
        )
        pages = result.pages
    })

    it('matchea la raíz', () => {
        expect(matchPage('/', pages)?.page.path).toBe('/')
    })

    it('matchea ruta estática', () => {
        expect(matchPage('/about', pages)?.page.path).toBe('/about')
    })

    it('matchea ruta dinámica y extrae params', () => {
        const result = matchPage('/blog/hello-world', pages)
        expect(result?.page.path).toBe('/blog/:slug')
        expect(result?.params).toEqual({slug: 'hello-world'})
    })

    it('decodifica params con URI encoding', () => {
        expect(matchPage('/blog/hello%20world', pages)?.params.slug).toBe('hello world')
    })

    it('devuelve null si no hay match', () => {
        expect(matchPage('/nonexistent', pages)).toBeNull()
    })
})