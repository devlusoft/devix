import {ComponentType} from "react";
import {routePattern} from "../utils/patterns";

export interface ClientMatch {
    load: () => Promise<{ default: ComponentType<any> }>
    loadLayouts: Array<() => Promise<{ default: ComponentType<any> }>>
    params: Record<string, string>
}

type GlobMap = Record<string, () => Promise<any>>

function fileToRoutePattern(filePath: string, pagesPrefix: string): string {
    const rel = filePath.slice(pagesPrefix.length)
    return routePattern(rel)
}

function collectLayoutChain(pageFile: string, layoutFiles: GlobMap): Array<() => Promise<any>> {
    const parts = pageFile.split('/')
    const chain: Array<() => Promise<any>> = []

    for (let i = 3; i <= parts.length - 1; i++) {
        const dir = parts.slice(0, i).join('/')
        const lp = `${dir}/layout.tsx`
        const lpts = `${dir}/layout.ts`
        if (layoutFiles[lp]) {
            chain.push(layoutFiles[lp])
        } else if (layoutFiles[lpts]) {
            chain.push(layoutFiles[lpts])
        }
    }

    return chain
}

export function createMatcher(pageFiles: GlobMap, layoutFiles: GlobMap) {
    const routes = Object.keys(pageFiles)
        .filter(f => !f.split('/').pop()!.startsWith('layout'))
        .map(file => {
            const pagesPrefix = file.slice(0, file.indexOf('/pages/') + '/pages'.length)
            const pattern = fileToRoutePattern(file, pagesPrefix)
            const params = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1])
            return { file, pattern, params, load: pageFiles[file], loadLayouts: collectLayoutChain(file,
                    layoutFiles) }
        })
        .sort((a, b) => {
            const aSegs = a.pattern.split('/').filter(Boolean)
            const bSegs = b.pattern.split('/').filter(Boolean)
            const len = Math.max(aSegs.length, bSegs.length)
            for (let i = 0; i < len; i++) {
                const aVal = i < aSegs.length ? (aSegs[i].startsWith(':') ? 1 : 2) : 0
                const bVal = i < bSegs.length ? (bSegs[i].startsWith(':') ? 1 : 2) : 0
                if (aVal !== bVal) return bVal - aVal
            }
            return b.pattern.length - a.pattern.length
        })

    return function matchClientRoute(pathname: string): ClientMatch | null {
        for (const route of routes) {
            const regexStr = route.pattern
                .replace(/:[^/]+/g, '([^/]+)')
                .replace(/\//g, '\\/')
            const match = pathname.match(new RegExp(`^${regexStr}$`))

            if (match) {
                const params: Record<string, string> = {}
                route.params.forEach((name, i) => {
                    params[name] = decodeURIComponent(match[i + 1])
                })
                return { load: route.load, loadLayouts: route.loadLayouts, params }
            }
        }
        return null
    }
}