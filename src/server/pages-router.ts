import {routePattern} from "../utils/patterns";

export interface Page {
    path: string
    key: string
    params: string[]
    regex: RegExp
}

export interface Layout {
    dir: string
    key: string
}

export interface PagesResult {
    pages: Page[]
    layouts: Layout[]
}

function keyToRoutePattern(key: string, pagesDir: string): string {
    const rel = key.slice(pagesDir.length + 1).replace(/\\/g, '/')
    const pattern = routePattern(rel)
    return pattern === "/" ? "/" : `/${pattern}`
}

function keyToDir(key: string): string {
    return key.slice(0, key.lastIndexOf('/'))
}

export function buildPages(pageKeys: string[], layoutKeys: string[], pagesDir: string): PagesResult {
    const pages: Page[] = []
    const layouts: Layout[] = []

    for (const key of layoutKeys) {
        layouts.push({dir: keyToDir(key), key})
    }

    for (const key of pageKeys) {
        const pattern = keyToRoutePattern(key, pagesDir)
        const params = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1])
        const regexStr = pattern
            .replace(/:[^/]+/g, '([^/]+)')
            .replace(/\//g, '\\/')
        pages.push({path: pattern, key, params, regex: new RegExp(`^${regexStr}$`)})
    }

    pages.sort((a, b) => {
        const aSegs = a.path.split('/').filter(Boolean)
        const bSegs = b.path.split('/').filter(Boolean)
        const len = Math.max(aSegs.length, bSegs.length)
        for (let i = 0; i < len; i++) {
            const aVal = i < aSegs.length ? (aSegs[i].startsWith(':') ? 1 : 2) : 0
            const bVal = i < bSegs.length ? (bSegs[i].startsWith(':') ? 1 : 2) : 0
            if (aVal !== bVal) return bVal - aVal
        }
        return b.path.length - a.path.length
    })

    return {pages, layouts}
}

export function collectLayoutChain(pageKey: string, layouts: Layout[]): Layout[] {
    const pageDir = keyToDir(pageKey)

    return layouts
        .filter(layout => pageDir.startsWith(layout.dir))
        .sort((a, b) => a.dir.split('/').length - b.dir.split('/').length)
}

export function matchPage(pathname: string, pages: Page[]): {
    page: Page
    params: Record<string, string>
} | null {
    for (const page of pages) {
        const match = pathname.match(page.regex)
        if (match) {
            const params: Record<string, string> = {}
            page.params.forEach((name, i) => {
                params[name] = decodeURIComponent(match[i + 1])
            })
            return {page, params}
        }
    }
    return null
}
