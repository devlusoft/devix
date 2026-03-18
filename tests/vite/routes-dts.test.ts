import {describe, it, expect} from 'vitest'
import {generateRoutesDts, filePathToIdentifier, buildRouteEntry} from '../../src/vite/codegen/routes-dts'

const API_DIR = 'app/api'

describe('filePathToIdentifier', () => {
    it('convierte ruta simple', () => {
        expect(filePathToIdentifier('app/api/me.ts', API_DIR)).toBe('_api_me')
    })

    it('convierte ruta dinámica', () => {
        expect(filePathToIdentifier('app/api/posts/[id].ts', API_DIR)).toBe('_api_posts__id_')
    })

    it('convierte index', () => {
        expect(filePathToIdentifier('app/api/posts/index.ts', API_DIR)).toBe('_api_posts_index')
    })
})

describe('generateRoutesDts', () => {
    it('genera bloque vacío si no hay entries', () => {
        const result = generateRoutesDts([], API_DIR)
        expect(result).toContain("interface ApiRoutes {}")
        expect(result).toContain('no editar')
    })

    it('genera imports correctos', () => {
        const entries = [
            buildRouteEntry('app/api/me.ts', API_DIR, ['GET']),
        ]
        const result = generateRoutesDts(entries, API_DIR)
        expect(result).toContain("import type * as _api_me from '../app/api/me'")
    })

    it('genera keys con :param en lugar de [param]', () => {
        const entries = [
            buildRouteEntry('app/api/posts/[id].ts', API_DIR, ['GET', 'DELETE']),
        ]
        const result = generateRoutesDts(entries, API_DIR)
        expect(result).toContain("'GET /api/posts/:id'")
        expect(result).toContain("'DELETE /api/posts/:id'")
        expect(result).toContain("from '../app/api/posts/[id]'")
    })

    it('incluye todos los métodos del entry', () => {
        const entries = [
            buildRouteEntry('app/api/posts/index.ts', API_DIR, ['GET', 'POST']),
        ]
        const result = generateRoutesDts(entries, API_DIR)
        expect(result).toContain("'GET /api/posts'")
        expect(result).toContain("'POST /api/posts'")
    })

    it('incluye InferRoute type helper', () => {
        const entries = [buildRouteEntry('app/api/me.ts', API_DIR, ['GET'])]
        expect(generateRoutesDts(entries, API_DIR)).toContain('type InferRoute')
    })

    it('incluye el header de advertencia', () => {
        const entries = [buildRouteEntry('app/api/me.ts', API_DIR, ['GET'])]
        expect(generateRoutesDts(entries, API_DIR)).toContain('auto-generado por devix')
    })

    it('genera múltiples entries correctamente', () => {
        const entries = [
            buildRouteEntry('app/api/me.ts', API_DIR, ['GET']),
            buildRouteEntry('app/api/posts/index.ts', API_DIR, ['GET', 'POST']),
            buildRouteEntry('app/api/posts/[id].ts', API_DIR, ['GET', 'DELETE']),
        ]
        const result = generateRoutesDts(entries, API_DIR)
        expect(result).toContain("'GET /api/me'")
        expect(result).toContain("'GET /api/posts'")
        expect(result).toContain("'POST /api/posts'")
        expect(result).toContain("'GET /api/posts/:id'")
        expect(result).toContain("'DELETE /api/posts/:id'")
    })
})
