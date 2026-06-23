import {describe, it, expect} from 'vitest'
import {generateApi} from '../../lib/vite/codegen/api'
import {generateRender} from '../../lib/vite/codegen/render'

describe('generateApi', () => {
    it('genera handleApiRequest con 3 parámetros (url, request, serverConfig)', () => {
        const code = generateApi({apiPath: '/abs/api.js', appDir: 'app'})
        expect(code).toMatch(/export function handleApiRequest\(url, request, serverConfig\)/)
    })

    it('propaga serverConfig a _handleApiRequest interno', () => {
        const code = generateApi({apiPath: '/abs/api.js', appDir: 'app'})
        expect(code).toMatch(/_handleApiRequest\(url, request, _glob, serverConfig\)/)
    })

    it('configura el glob apuntando al appDir/api', () => {
        const code = generateApi({apiPath: '/abs/api.js', appDir: 'src/app'})
        expect(code).toContain("apiDir: '/src/app/api'")
        expect(code).toContain("import.meta.glob(['/src/app/api/**/*.ts'")
    })
})

describe('generateRender', () => {
    it('render propaga options al runtime', () => {
        const code = generateRender({pagesDir: 'app/pages', renderPath: '/abs/render.js'})
        expect(code).toMatch(/export function render\(url, request, options\)/)
        expect(code).toMatch(/_render\(url, request, _glob, options\)/)
    })

    it('getStaticRoutes pasa solo el glob', () => {
        const code = generateRender({pagesDir: 'app/pages', renderPath: '/abs/render.js'})
        expect(code).toMatch(/_getStaticRoutes\(_glob\)/)
    })
})
