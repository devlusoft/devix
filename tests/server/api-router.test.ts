import {describe, it, expect, beforeEach} from 'vitest'
import {buildRoutes, matchRoute} from '../../src/server'
import {invalidateApiCache} from '../../src/server/api-router'

beforeEach(() => {
    invalidateApiCache()
})

const API_DIR = 'app/api'

function makeKeys(files: string[]) {
    return files.map(f => `${API_DIR}/${f}`)
}

describe('buildRoutes', () => {
    it('devuelve vacío si no hay keys', () => {
        const result = buildRoutes([], [], API_DIR)
        expect(result.routes).toHaveLength(0)
        expect(result.middlewares).toHaveLength(0)
    })

    it('escanea rutas de API', () => {
        const {routes} = buildRoutes(makeKeys(['users.ts', 'posts/[id].ts']), [], API_DIR)
        const paths = routes.map(r => r.path)
        expect(paths).toContain('/api/users')
        expect(paths).toContain('/api/posts/:id')
    })

    it('separa middlewares de rutas', () => {
        const {routes, middlewares} = buildRoutes(
            makeKeys(['users.ts']),
            makeKeys(['middleware.ts']),
            API_DIR
        )
        expect(routes).toHaveLength(1)
        expect(middlewares).toHaveLength(1)
    })

    it('ordena rutas estáticas antes que dinámicas', () => {
        const {routes} = buildRoutes(makeKeys(['users/[id].ts', 'users/me.ts']), [], API_DIR)
        const paths = routes.map(r => r.path)
        expect(paths.indexOf('/api/users/me')).toBeLessThan(paths.indexOf('/api/users/:id'))
    })
})

describe('matchRoute', () => {
    let routes: ReturnType<typeof buildRoutes>['routes']

    beforeEach(() => {
        const result = buildRoutes(
            makeKeys(['users.ts', 'users/[id].ts']),
            [],
            API_DIR
        )
        routes = result.routes
    })

    it('matchea ruta estática', () => {
        expect(matchRoute('/api/users', routes)?.route.path).toBe('/api/users')
    })

    it('matchea ruta dinámica y extrae params', () => {
        const result = matchRoute('/api/users/42', routes)
        expect(result?.route.path).toBe('/api/users/:id')
        expect(result?.params).toEqual({id: '42'})
    })

    it('devuelve null si no hay match', () => {
        expect(matchRoute('/api/nonexistent', routes)).toBeNull()
    })
})