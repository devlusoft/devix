import {describe, it, expect, beforeEach} from 'vitest'
import {buildPages, collectLayoutChain} from '../../src/server'
import {invalidatePagesCache} from '../../src/server/pages-router'

beforeEach(() => {
    invalidatePagesCache()
})

const PAGES_DIR = 'app/pages'

function makePageKeys(files: string[]) {
    return files.map(f => `${PAGES_DIR}/${f}`)
}

function makeLayoutKeys(files: string[]) {
    return files.map(f => `${PAGES_DIR}/${f}`)
}

describe('collectLayoutChain', () => {
    it('retorna vacío si no hay layouts', () => {
        const {pages, layouts} = buildPages(makePageKeys(['index.tsx']), [], PAGES_DIR)
        expect(collectLayoutChain(pages[0].key, layouts)).toHaveLength(0)
    })

    it('retorna el layout raíz para cualquier página', () => {
        const {pages, layouts} = buildPages(
            makePageKeys(['about.tsx']),
            makeLayoutKeys(['layout.tsx']),
            PAGES_DIR
        )
        const chain = collectLayoutChain(pages[0].key, layouts)
        expect(chain).toHaveLength(1)
        expect(chain[0].key).toContain('layout.tsx')
    })

    it('retorna cadena de layouts anidados ordenada de raíz a hoja', () => {
        const {pages, layouts} = buildPages(
            makePageKeys(['blog/posts/index.tsx']),
            makeLayoutKeys(['layout.tsx', 'blog/layout.tsx', 'blog/posts/layout.tsx']),
            PAGES_DIR
        )
        const chain = collectLayoutChain(pages[0].key, layouts)
        expect(chain).toHaveLength(3)
        expect(chain[0].key).toContain('app/pages/layout.tsx')
        expect(chain[1].key).toContain('blog/layout.tsx')
        expect(chain[2].key).toContain('blog/posts/layout.tsx')
    })

    it('no incluye layouts de ramas distintas', () => {
        const {pages, layouts} = buildPages(
            makePageKeys(['blog/index.tsx']),
            makeLayoutKeys(['layout.tsx', 'blog/layout.tsx', 'dashboard/layout.tsx']),
            PAGES_DIR
        )
        const chain = collectLayoutChain(pages[0].key, layouts)
        expect(chain).toHaveLength(2)
        expect(chain.map(l => l.key)).not.toContain(expect.stringContaining('dashboard'))
    })
})