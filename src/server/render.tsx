import {createElement} from 'react'
import {renderToString, renderToStaticMarkup} from 'react-dom/server'
import {buildHeadNodes} from '../runtime/head'
import {ServerApp} from '../runtime/server-app'
import {buildPages, matchPage, collectLayoutChain, PagesResult} from './pages-router'
import {resolveMetadata, mergeMetadata} from '../runtime/metadata'
import type {PageModule, LayoutModule, PageGlob} from './types'
import type {Manifest} from "vite";
import {escapeAttr, safeJsonStringify} from "../utils/html";
import {withTimeout} from "../utils/async";
import {isRedirect, isLoaderError} from "../utils/response";

let pagesCache: PagesResult | null = null
let pagesCacheKey: string | null = null

const DEV_CLIENT_ENTRY = '/@id/virtual:devix/entry-client'

function extractRedirect(result: unknown): { url: string, status: number, replace: boolean } | null {
    if (typeof result === 'string') return {url: result, status: 302, replace: false}
    if (isRedirect(result)) return {url: result.url, status: result.status, replace: result.replace}
    return null
}

async function resolvePageData(pathname: string, request: Request, glob: PageGlob, timeout: number) {
    const cacheKey = Object.keys(glob.pages).sort().join('\0') + '|' + Object.keys(glob.layouts).sort().join('\0')
    if (!pagesCache || pagesCacheKey !== cacheKey) {
        pagesCache = buildPages(Object.keys(glob.pages), Object.keys(glob.layouts), glob.pagesDir)
        pagesCacheKey = cacheKey
    }
    const {pages, layouts} = pagesCache
    const matched = matchPage(pathname, pages)
    if (!matched) return null

    const {page, params} = matched
    const layoutChain = collectLayoutChain(page.key, layouts)

    const [pageMod, ...layoutMods] = await Promise.all([
        glob.pages[page.key]() as Promise<PageModule>,
        ...layoutChain.map(l => glob.layouts[l.key]() as Promise<LayoutModule>),
    ])

    let guardData: unknown = undefined

    for (const mod of layoutMods) {
        if (mod.guard) {
            const result = await mod.guard({params, request, guardData})
            const r = extractRedirect(result)
            if (r !== null) return {redirect: r.url, redirectStatus: r.status, redirectReplace: r.replace}
            if (isLoaderError(result)) return {loaderError: result}
            if (result !== null && result !== undefined) guardData = result
        }
    }

    if (pageMod.guard) {
        const result = await pageMod.guard({params, request, guardData})
        const r = extractRedirect(result)
        if (r !== null) return {redirect: r.url, redirectStatus: r.status, redirectReplace: r.replace}
        if (isLoaderError(result)) return {loaderError: result}
        if (result !== null && result !== undefined) guardData = result
    }

    const ctx = {params, request, guardData}

    const rawLoaderData = pageMod.loader
        ? await withTimeout(pageMod.loader(ctx) as Promise<unknown>, timeout)
        : null

    if (isRedirect(rawLoaderData)) return {
        redirect: rawLoaderData.url,
        redirectStatus: rawLoaderData.status,
        redirectReplace: rawLoaderData.replace
    }
    if (isLoaderError(rawLoaderData)) return {loaderError: rawLoaderData}
    const loaderData = rawLoaderData

    const rawLayoutsData = await withTimeout(
        Promise.all(layoutMods.map(mod => mod.loader ? mod.loader(ctx) : null)),
        timeout
    )
    for (const raw of rawLayoutsData) {
        if (isRedirect(raw)) return {redirect: raw.url, redirectStatus: raw.status, redirectReplace: raw.replace}
        if (isLoaderError(raw)) return {loaderError: raw}
    }
    const layoutsData = rawLayoutsData

    const pageMeta = await resolveMetadata(pageMod, {...ctx, loaderData})
    const layoutsMeta = await Promise.all(
        layoutMods.map((mod, i) => resolveMetadata(mod, {...ctx, loaderData: layoutsData[i]}))
    )

    const metadata = mergeMetadata(...layoutsMeta.map(m => m.metadata), pageMeta.metadata)
    const viewport = pageMeta.viewport ?? layoutsMeta.findLast(m => m.viewport)?.viewport

    const rootLayoutMod = layoutMods[0]
    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang({...ctx, loaderData: layoutsData[0]})
        : rootLayoutMod?.lang ?? 'en'

    return {pageMod, layoutMods, params, loaderData, layoutsData, metadata, viewport, lang}
}

export async function runLoader(url: string, request: Request, glob: PageGlob, options?: { loaderTimeout?: number }) {
    const {pathname} = new URL(url, 'http://localhost')
    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        const timeout = options?.loaderTimeout ?? 10_000
        result = await resolvePageData(pathname, request, glob, timeout)
    } catch (err) {
        console.error('[devix] render error:', err)
        return {error: true as const, loaderData: null, params: {}, layouts: [], metadata: null, viewport: undefined}
    }

    if (!result) {
        return {loaderData: null, params: {}, layouts: [], metadata: null, viewport: undefined}
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

    const {loaderData, params, layoutsData, metadata, viewport} = result
    return {
        loaderData,
        params,
        layouts: layoutsData.map(loaderData => ({loaderData})),
        metadata,
        viewport,
    }
}

export async function render(
    url: string,
    request: Request,
    glob: PageGlob,
    options?: { manifest?: Manifest, loaderTimeout?: number },
) {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    const {pathname} = new URL(url, 'http://localhost')

    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        const timeout = options?.loaderTimeout ?? 10_000
        result = await resolvePageData(pathname, request, glob, timeout)
    } catch (err) {
        console.error('[devix] render error:', err)
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}</head><body><script>window.__DEVIX__=null;window.__LOADER_DATA__=null;window.__LAYOUTS_DATA__=[];</script><script type="module" src="${clientEntry}"></script><div id="devix-root"></div></body></html>`
        return {html, statusCode: 500, headers: {}}
    }

    if (!result) {
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
            metadata: null,
            viewport: undefined,
            clientEntry
        })};window.__LOADER_DATA__=null;window.__LAYOUTS_DATA__=[];</script>`
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}${dataScript}</head><body><div id="devix-root"></div>${clientScript}</body></html>`
        return {html, statusCode: 404, headers: {}}
    }

    if ('redirect' in result) {
        return {html: '', statusCode: result.redirectStatus, headers: {Location: result.redirect}}
    }

    if ('loaderError' in result) {
        const {statusCode, message, data} = result.loaderError!
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({metadata: null, viewport: undefined, clientEntry})};window.__LOADER_DATA__=null;window.__LAYOUTS_DATA__=[];window.__LOADER_ERROR__=${safeJsonStringify({statusCode, message, data})};</script>`
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}${dataScript}</head><body><div id="devix-root"></div>${clientScript}</body></html>`
        return {html, statusCode, headers: {}}
    }

    const {pageMod, layoutMods, params, loaderData, layoutsData, metadata, viewport, lang} = result

    const content = renderToString(createElement(ServerApp, {
        pathname,
        params,
        loaderData,
        layoutsData,
        Page: pageMod.default as any,
        layouts: layoutMods.map(m => m.default as any),
        metadata: metadata ?? null,
        viewport,
        clientEntry,
    }))
    const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry
    })};window.__LOADER_DATA__=${safeJsonStringify(loaderData ?? null)};window.__LAYOUTS_DATA__=${safeJsonStringify(layoutsData)};</script>`
    const clientScript = `<script type="module" src="${clientEntry}"></script>`
    const customHeaders: Record<string, string> = pageMod.headers ?? {}

    const html = `<html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">${content}</div>${clientScript}</body></html>`

    return {html, statusCode: 200, headers: customHeaders}
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

