import {routePattern} from "../utils/patterns";

export interface ApiRoute {
    path: string
    key: string
    params: string[]
    regex: RegExp
}

export interface ApiMiddleware {
    dir: string
    key: string
}

export interface ApiResult {
    routes: ApiRoute[]
    middlewares: ApiMiddleware[]
}

export function keyToRoutePattern(key: string, apiDir: string): string {
    const rel = key.slice(apiDir.length + 1).replace(/\\/g, '/')
    const pattern = routePattern(rel)
    return pattern === '/' ? '/api' : `/api/${pattern}`.replace('/api//', '/api/')
}

function keyToDir(key: string): string {
    return key.slice(0, key.lastIndexOf('/'))
}

let cache: ApiResult | null = null

export function invalidateApiCache() {
    cache = null
}

export function buildRoutes(routeKeys: string[], middlewareKeys: string[], apiDir: string): ApiResult {
    if (cache) return cache

    const routes: ApiRoute[] = []
    const middlewares: ApiMiddleware[] = []

    for (const key of middlewareKeys) {
        middlewares.push({dir: keyToDir(key), key})
    }

    for (const key of routeKeys) {
        const pattern = keyToRoutePattern(key, apiDir)
        const params = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1])
        const regexStr = pattern
            .replace(/:[^/]+/g, '([^/]+)')
            .replace(/\//g, '\\/')
        routes.push({path: pattern, key, params, regex: new RegExp(`^${regexStr}$`)})
    }
    routes.sort((a, b) => {
        const aScore = (a.path.match(/:/g) || []).length
        const bScore = (b.path.match(/:/g) || []).length
        if (aScore !== bScore) return aScore - bScore
        return b.path.length - a.path.length
    })

    cache = {routes, middlewares}
    return cache
}

export function collectMiddlewareChain(routeKey: string, middlewares: ApiMiddleware[]): ApiMiddleware[] {
    const routeDir = keyToDir(routeKey)

    return middlewares
        .filter(mw => routeDir.startsWith(mw.dir))
        .sort((a, b) => a.dir.split('/').length - b.dir.split('/').length)
}

export function matchRoute(
    pathname: string,
    routes: ApiRoute[]
): {route: ApiRoute; params: Record<string, string>} | null {
    for (const route of routes) {
        const match = pathname.match(route.regex)
        if (match) {
            const params: Record<string, string> = {}
            route.params.forEach((name, i) => {
                params[name] = decodeURIComponent(match[i + 1])
            })
            return {route, params}
        }
    }
    return null
}
