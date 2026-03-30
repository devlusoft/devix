import {describe, it, expect, beforeEach} from 'vitest'
import {buildPages, matchPage} from '../../src/server'

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

    it('segmento estático gana sobre dinámico en la misma posición', () => {
        const {pages} = buildPages(
            makeKeys(['users/[id]/settings.tsx', 'users/new/settings.tsx']),
            [], PAGES_DIR
        )
        const paths = pages.map(p => p.path)
        expect(paths.indexOf('/users/new/settings')).toBeLessThan(paths.indexOf('/users/:id/settings'))
    })

    it('ruta estática+dinámica gana sobre dinámica+estática cuando el estático aparece antes', () => {
        const {pages} = buildPages(
            makeKeys(['users/[id]/settings.tsx', 'users/new/[section].tsx']),
            [], PAGES_DIR
        )
        const paths = pages.map(p => p.path)
        expect(paths.indexOf('/users/new/:section')).toBeLessThan(paths.indexOf('/users/:id/settings'))
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

describe('matchPage — prioridad de rutas', () => {
    it('segmento estático gana sobre dinámico para el mismo path', () => {
        const {pages} = buildPages(
            makeKeys(['users/[id].tsx', 'users/new.tsx']),
            [], PAGES_DIR
        )
        expect(matchPage('/users/new', pages)?.page.path).toBe('/users/new')
    })

    it('dinámico no captura el segmento estático que tiene su propia ruta', () => {
        const {pages} = buildPages(
            makeKeys(['users/[id].tsx', 'users/new.tsx']),
            [], PAGES_DIR
        )
        const result = matchPage('/users/new', pages)
        expect(result?.params).toEqual({})
    })

    it('estático en posición intermedia gana sobre dinámico', () => {
        const {pages} = buildPages(
            makeKeys(['users/[id]/settings.tsx', 'users/new/[section].tsx']),
            [], PAGES_DIR
        )
        expect(matchPage('/users/new/profile', pages)?.page.path).toBe('/users/new/:section')
        expect(matchPage('/users/new/profile', pages)?.params).toEqual({section: 'profile'})
    })

    it('ruta totalmente dinámica sigue matcheando cuando no hay conflicto', () => {
        const {pages} = buildPages(
            makeKeys(['users/[id].tsx', 'users/new.tsx']),
            [], PAGES_DIR
        )
        expect(matchPage('/users/123', pages)?.page.path).toBe('/users/:id')
        expect(matchPage('/users/123', pages)?.params).toEqual({id: '123'})
    })
})