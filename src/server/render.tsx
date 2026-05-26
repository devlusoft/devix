import {__setFrame} from '../runtime/request-context'
import {buildPages, matchPage, collectLayoutChain, PagesResult} from './pages-router'
import type {PageModule, LayoutModule, PageGlob} from './types'
import {isRedirect, isLoaderError} from "../utils/response";
import type {ServerBackendConfig} from "../config";
import {makeBoundServer} from "./server-bound";
import {runWithQueryCache, QueryCache, initQueryCache} from './query-cache'

initQueryCache()

let pagesCache: PagesResult | null = null
let pagesCacheKey: string | null = null

function extractRedirect(result: unknown): { url: string, status: number, replace: boolean } | null {
    if (typeof result === 'string') return {url: result, status: 302, replace: false}
    if (isRedirect(result)) return {url: result.url, status: result.status, replace: result.replace}
    return null
}

export async function resolvePageData(pathname: string, request: Request, glob: PageGlob, serverConfig?: Record<string, ServerBackendConfig>) {
    const cacheKey = Object.keys(glob.pages).sort().join('\0') + '|' + Object.keys(glob.layouts).sort().join('\0')
    if (!pagesCache || pagesCacheKey !== cacheKey) {
        pagesCache = buildPages(Object.keys(glob.pages), Object.keys(glob.layouts), glob.pagesDir)
        pagesCacheKey = cacheKey
    }
    const {pages, layouts} = pagesCache
    const matched = matchPage(pathname, pages)
    if (!matched) return null

    const {page, params} = matched
    const layoutChain = collectLayoutChain(page.key, layouts, glob.pagesDir)

    const [pageMod, ...layoutMods] = await Promise.all([
        glob.pages[page.key]() as Promise<PageModule>,
        ...layoutChain.map(l => glob.layouts[l.key]() as Promise<LayoutModule>),
    ])

    const rootLayoutKey = `${glob.pagesDir}/layout.tsx`
    let rootLayoutMod: LayoutModule | undefined
    if (glob.layouts[rootLayoutKey]) {
        rootLayoutMod = await glob.layouts[rootLayoutKey]() as LayoutModule
    }

    let guardData: unknown = undefined
    const $server = makeBoundServer(request, serverConfig)

    if (rootLayoutMod?.guard) {
        const result = await rootLayoutMod.guard({params, request, guardData, $server})
        const r = extractRedirect(result)
        if (r !== null) return {redirect: r.url, redirectStatus: r.status, redirectReplace: r.replace}
        if (isLoaderError(result)) return {loaderError: result}
        if (result !== null && result !== undefined) guardData = result
    }

    for (const mod of layoutMods) {
        if (mod.guard) {
            const result = await mod.guard({params, request, guardData, $server})
            const r = extractRedirect(result)
            if (r !== null) return {redirect: r.url, redirectStatus: r.status, redirectReplace: r.replace}
            if (isLoaderError(result)) return {loaderError: result}
            if (result !== null && result !== undefined) guardData = result
        }
    }

    if (pageMod.guard) {
        const result = await pageMod.guard({params, request, guardData, $server})
        const r = extractRedirect(result)
        if (r !== null) return {redirect: r.url, redirectStatus: r.status, redirectReplace: r.replace}
        if (isLoaderError(result)) return {loaderError: result}
        if (result !== null && result !== undefined) guardData = result
    }

    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang({params, request, guardData, $server})
        : rootLayoutMod?.lang ?? 'en'

    return {pageMod, layoutMods, params, guardData, lang}
}

export async function runLoader(url: string, request: Request, glob: PageGlob, options?: {
    server?: Record<string, ServerBackendConfig>
}) {
    __setFrame({request, responseHeaders: new Headers()})
    const {pathname} = new URL(url, 'http://localhost')
    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        result = await resolvePageData(pathname, request, glob, options?.server)
    } catch (err) {
        __setFrame(null)
        console.error('[devix] render error:', err)
        return {error: true as const, params: {}}
    }

    if (!result) {
        return {params: {}}
    }

    if ('redirect' in result) {
        return {
            redirect: result.redirect,
            redirectStatus: result.redirectStatus,
            redirectReplace: result.redirectReplace
        }
    }

    if ('loaderError' in result) {
        return {loaderError: result.loaderError}
    }

    const {params, guardData} = result
    return {
        params,
        guardData,
    }
}

export async function getStaticRoutes(glob: PageGlob): Promise<string[]> {
    const {pages} = buildPages(Object.keys(glob.pages), Object.keys(glob.layouts), glob.pagesDir)
    const urls: string[] = []

    for (const page of pages) {
        if (page.params.length === 0) {
            urls.push(page.path)
        } else {
            const mod = await glob.pages[page.key]() as PageModule
            if (!mod.generateStaticParams) continue
            const paramSets = await mod.generateStaticParams()
            for (const params of paramSets) {
                let url = page.path
                for (const [key, value] of Object.entries(params)) {
                    url = url.replace(`:${key}`, encodeURIComponent(value))
                }
                urls.push(url)
            }
        }
    }

    return urls
}
