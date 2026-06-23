import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {buildHeadNodes} from '../runtime/head'
import {ServerApp} from '../runtime/server-app'
import {buildPages, matchPage, collectLayoutChain, PagesResult} from './pages-router'
import {resolveMetadata, mergeMetadata} from '../runtime/metadata'
import type {PageModule, LayoutModule, PageGlob} from './types'
import type {Manifest} from "vite";
import {escapeAttr, safeJsonStringify} from "../utils/html";
import {withTimeout} from "../utils/async";
import {collectEncode, stringToBase64} from "../utils/turbo-serializer";
import {isRedirect, isLoaderError, isDeferred, errorToBody, NotFoundError, RedirectError, LoaderError} from "../utils/response";
import type {Viewport} from "../types";
import {PassThrough} from "node:stream";
import {createHtmlStream} from "./stream-html";
import {runWithRequestEvent, createRequestEvent} from "../data/request-context";


const DEFAULT_VIEWPORT: Viewport = {width: 'device-width', initialScale: 1}

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

    const rawLoaderData: unknown = null

    if (isRedirect(rawLoaderData)) return {
        redirect: rawLoaderData.url,
        redirectStatus: rawLoaderData.status,
        redirectReplace: rawLoaderData.replace
    }
    if (isLoaderError(rawLoaderData)) return {loaderError: rawLoaderData}
    const loaderData: unknown = rawLoaderData

    const rawLayoutsData: unknown[] = await withTimeout(
        Promise.all(layoutMods.map(() => null)),
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
    const viewport = pageMeta.viewport ?? layoutsMeta.findLast(m => m.viewport)?.viewport ?? DEFAULT_VIEWPORT

    const rootLayoutMod = layoutMods[0]
    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang({...ctx, loaderData: layoutsData[0]})
        : rootLayoutMod?.lang ?? 'en'

    return {pageMod, layoutMods, params, loaderData, layoutsData, guardData, metadata, viewport, lang}
}

export async function runLoader(url: string, request: Request, glob: PageGlob, options?: {
    loaderTimeout?: number;
}) {
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

    const {loaderData, params, layoutsData, guardData, metadata, viewport} = result
    return {
        loaderData,
        params,
        layouts: (layoutsData as unknown[]).map((loaderData: unknown) => ({loaderData})),
        guardData,
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
        const errBody = errorToBody(result.loaderError!)
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
            metadata: null,
            viewport: undefined,
            clientEntry
        })};window.__LOADER_DATA__=null;window.__LAYOUTS_DATA__=[];window.__LOADER_ERROR__=${safeJsonStringify(errBody)};</script>`
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}${dataScript}</head><body><div id="devix-root"></div>${clientScript}</body></html>`
        return {html, statusCode: errBody.statusCode, headers: {}}
    }

    const {pageMod, layoutMods, params, loaderData, layoutsData, guardData, metadata, viewport, lang} = result

    const [syncLoader, deferredLoaderKeys] = separateDeferred(loaderData as Record<string, unknown> | null)
    const syncLayouts = (layoutsData as unknown[]).map((d: unknown) => separateDeferred(d as Record<string, unknown> | null)[0])

    const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

    const turboStr = await collectEncode({
        LOADER_DATA: syncLoader ?? null,
        LAYOUTS_DATA: syncLayouts,
        GUARD_DATA: guardData ?? null,
    })
    const syncB64 = stringToBase64(turboStr)
    const deferredScript = deferredLoaderKeys?.length
        ? `window.__DEVIX_DEFERRED__=${safeJsonStringify(deferredLoaderKeys)};`
        : ''
    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry
    })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};${deferredScript}</script>`
    const clientScript = `<script type="module" src="${clientEntry}"></script>`
    const customHeaders: Record<string, string> = pageMod.headers ?? {}

    const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">`
    const tail = `</div>${clientScript}</body></html>`

    const event = createRequestEvent(pathname)
    const html = await runWithRequestEvent(event, async () => {
        const { stream } = await createHtmlStream(
            createElement(ServerApp, {
                pathname,
                params,
                loaderData,
                layoutsData,
                guardData,
                Page: pageMod.default as any,
                layouts: layoutMods.map(m => m.default as any),
                metadata: metadata ?? null,
                viewport,
                clientEntry,
            }),
            head,
            tail,
            {
                onError: (err) => console.error('[devix] render error:', err),
                beforeTail: (write) => {
                    const map = event.queryHydration
                    if (!map || map.size === 0) return
                    const data = Object.fromEntries(map)
                    write(`<script>window.__DEVIX_QUERIES__=${safeJsonStringify(data)};</script>`)
                },
            },
        )
        const chunks: string[] = []
        for await (const chunk of stream) {
            chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
        }
        return chunks.join('')
    })

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

export async function renderStream(url: string, request: Request, glob: PageGlob, options?: {
    manifest?: Manifest,
    loaderTimeout?: number,
},): Promise<{ stream: PassThrough, statusCode: number, headers: Record<string, string> }> {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    const {pathname} = new URL(url, 'http://localhost')

    const event = createRequestEvent(pathname)

    return runWithRequestEvent(event, async () => {
        let result: Awaited<ReturnType<typeof resolvePageData>>
        try {
            const timeout = options?.loaderTimeout ?? 10_000
            result = await resolvePageData(pathname, request, glob, timeout)
        } catch (err) {
            console.error('[devix] render error:', err)
            throw err
        }

        if (!result) {
            throw new NotFoundError()
        }

        if ('redirect' in result) {
            const {redirect, redirectStatus, redirectReplace} = result as {
                redirect: string
                redirectStatus: number
                redirectReplace: boolean
            }
            throw new RedirectError(redirect, redirectStatus, redirectReplace)
        }

        if ('loaderError' in result) {
            throw new LoaderError(errorToBody(result.loaderError!))
        }

        const {pageMod, layoutMods, params, loaderData, layoutsData, guardData, metadata, viewport, lang} = result

        const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

        const [syncLoader, deferredLoaderKeys] = separateDeferred(loaderData as Record<string, unknown> | null)
        const syncLayouts = (layoutsData as unknown[]).map((d: unknown) => separateDeferred(d as Record<string, unknown> | null)[0])

        const turboStr = await collectEncode({
            LOADER_DATA: syncLoader ?? null,
            LAYOUTS_DATA: syncLayouts,
            GUARD_DATA: guardData ?? null,
        })
        const syncB64 = stringToBase64(turboStr)
        const deferredScript = deferredLoaderKeys?.length
            ? `window.__DEVIX_DEFERRED__=${safeJsonStringify(deferredLoaderKeys)};`
            : ''
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
            metadata,
            viewport,
            clientEntry,
        })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};${deferredScript}</script>`

        const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">`
        const tail = `</div></body></html>`

        const {stream} = await createHtmlStream(
            createElement(ServerApp, {
                pathname,
                params,
                loaderData,
                layoutsData,
                guardData,
                Page: pageMod.default as any,
                layouts: layoutMods.map(m => m.default as any),
                metadata: metadata ?? null,
                viewport,
                clientEntry,
            }),
            head,
            tail,
            {
                bootstrapModules: [clientEntry],
                onError: (err) => console.error('[devix] Streaming error:', err),
                beforeTail: (write) => {
                    const map = event.queryHydration
                    if (!map || map.size === 0) return
                    const data = Object.fromEntries(map)
                    write(`<script>window.__DEVIX_QUERIES__=${safeJsonStringify(data)};</script>`)
                },
            },
        )
        return {stream, statusCode: 200, headers: pageMod.headers ?? {}}
    })
}

function separateDeferred<T extends Record<string, unknown>>(obj: T | null | undefined): [T | null, string[] | null] {
    if (!obj) return [null, null]

    const sync: Record<string, unknown> = {}
    const deferred: string[] = []

    for (const [key, value] of Object.entries(obj)) {
        if (value instanceof Promise || isDeferred(value)) deferred.push(key)
        else sync[key] = value
    }

    return [sync as T, deferred.length > 0 ? deferred : null]
}