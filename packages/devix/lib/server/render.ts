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
import {isRedirect, isLoaderError, errorToBody, NotFoundError, RedirectError} from "../utils/response";
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

type ResolvedPage = {
    pageMod: PageModule
    layoutMods: LayoutModule[]
    params: Record<string, string>
    guardData: unknown
    metadata: Awaited<ReturnType<typeof resolveMetadata>>['metadata']
    viewport?: Viewport
    lang: string
}

type ResolveResult =
    | ResolvedPage
    | { redirect: string; redirectStatus: number; redirectReplace: boolean }
    | { error: unknown }
    | null

async function resolvePageData(pathname: string, request: Request, glob: PageGlob, timeout: number): Promise<ResolveResult> {
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
            if (isLoaderError(result)) return {error: result}
            if (result !== null && result !== undefined) guardData = result
        }
    }

    if (pageMod.guard) {
        const result = await pageMod.guard({params, request, guardData})
        const r = extractRedirect(result)
        if (r !== null) return {redirect: r.url, redirectStatus: r.status, redirectReplace: r.replace}
        if (isLoaderError(result)) return {error: result}
        if (result !== null && result !== undefined) guardData = result
    }

    const ctx = {params, request, guardData}

    const pageMeta = await resolveMetadata(pageMod, ctx)
    const layoutsMeta = await Promise.all(
        layoutMods.map(mod => resolveMetadata(mod, ctx))
    )

    const metadata = mergeMetadata(...layoutsMeta.map(m => m.metadata), pageMeta.metadata)
    const viewport = pageMeta.viewport ?? layoutsMeta.findLast(m => m.viewport)?.viewport ?? DEFAULT_VIEWPORT

    const rootLayoutMod = layoutMods[0]
    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang(ctx)
        : rootLayoutMod?.lang ?? 'en'

    return {pageMod, layoutMods, params, guardData, metadata, viewport, lang}
}

export interface RenderStreamResult {
    statusCode: number
    headers: Record<string, string>
    stream: PassThrough
}

export interface RenderDataResult {
    statusCode: number
    headers: Record<string, string>
    guardData?: unknown
    redirect?: { url: string; status: number; replace: boolean }
    error?: { statusCode: number; message: string; code?: string; data?: unknown }
    queryHydration: Record<string, unknown>
    params: Record<string, string>
    metadata: unknown
    viewport?: Viewport
    lang: string
}

/**
 * Resolves a page and runs guards + queries so that `event.queryHydration`
 * is populated by the time it returns. The returned `event` is the
 * active request event — callers can read its `queryHydration` later.
 */
async function executeRoute(
    url: string,
    request: Request,
    glob: PageGlob,
    timeout: number,
): Promise<{ result: ResolveResult; event: ReturnType<typeof createRequestEvent> }> {
    const event = createRequestEvent(new URL(url, 'http://localhost').pathname)
    const result = await runWithRequestEvent(event, () =>
        resolvePageData(new URL(url, 'http://localhost').pathname, request, glob, timeout),
    )
    return { result, event }
}

export async function render(
    url: string,
    request: Request,
    glob: PageGlob,
    options?: { manifest?: Manifest; loaderTimeout?: number; cssLinks?: string },
): Promise<RenderStreamResult> {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = options?.cssLinks ?? cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    const {pathname} = new URL(url, 'http://localhost')

    let result: Awaited<ReturnType<typeof resolvePageData>>
    let event: ReturnType<typeof createRequestEvent>
    try {
        const timeout = options?.loaderTimeout ?? 10_000
        const r = await executeRoute(url, request, glob, timeout)
        result = r.result
        event = r.event
    } catch (err) {
        console.error('[devix] render error:', err)
        const stream = new PassThrough()
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}</head><body><script>window.__DEVIX__=null;</script><script type="module" src="${clientEntry}"></script><div id="devix-root"></div></body></html>`
        stream.end(html)
        return {stream, statusCode: 500, headers: {}}
    }

    if (!result) {
        const stream = new PassThrough()
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
            metadata: null,
            viewport: undefined,
            clientEntry
        })};</script>`
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}${dataScript}</head><body><div id="devix-root"></div>${clientScript}</body></html>`
        stream.end(html)
        return {stream, statusCode: 404, headers: {}}
    }

    if ('redirect' in result) {
        const stream = new PassThrough()
        stream.end()
        return {stream, statusCode: result.redirectStatus, headers: {Location: result.redirect}}
    }

    if ('error' in result) {
        const errBody = errorToBody(result.error as { statusCode: number; message: string; code?: string; data?: unknown })
        const stream = new PassThrough()
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
            metadata: null,
            viewport: undefined,
            clientEntry
        })};window.__DEVIX_ERROR__=${safeJsonStringify(errBody)};</script>`
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}${dataScript}</head><body><div id="devix-root"></div>${clientScript}</body></html>`
        stream.end(html)
        return {stream, statusCode: errBody.statusCode, headers: {}}
    }

    const {pageMod, layoutMods, params, guardData, metadata, viewport, lang} = result

    const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

    const turboStr = await collectEncode({
        GUARD_DATA: guardData ?? null,
    })
    const syncB64 = stringToBase64(turboStr)
    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry
    })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};</script>`
    const clientScript = `<script type="module" src="${clientEntry}"></script>`
    const customHeaders: Record<string, string> = pageMod.headers ?? {}

    const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">`
    const tail = `</div>${clientScript}</body></html>`

    return runWithRequestEvent(event!, async () => {
        const { stream } = await createHtmlStream(
            createElement(ServerApp, {
                pathname,
                params,
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
                    const map = event!.queryHydration
                    if (!map || map.size === 0) return
                    const data = Object.fromEntries(map)
                    write(`<script>window.__DEVIX_QUERIES__=${safeJsonStringify(data)};</script>`)
                },
            },
        )
        return {stream, statusCode: 200, headers: customHeaders}
    })
}


/**
 * Renders the data payload used by client-side navigation (the /_devix/data/*
 * endpoint). Returns a JSON-friendly object instead of an HTML stream.
 *
 * To populate `queryHydration` we must actually run the page module so that
 * any `useQuery(() => …)` calls execute on the server. The page is rendered
 * and the resulting stream is consumed (discarded) so the side effects of
 * rendering — including populating `event.queryHydration` — have run.
 */
export async function renderData(
    url: string,
    request: Request,
    glob: PageGlob,
    options?: { manifest?: Manifest; loaderTimeout?: number; cssLinks?: string },
): Promise<RenderDataResult> {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = options?.cssLinks ?? cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    const {pathname} = new URL(url, 'http://localhost')
    const timeout = options?.loaderTimeout ?? 10_000

    let result: Awaited<ReturnType<typeof resolvePageData>>
    let event: ReturnType<typeof createRequestEvent>
    try {
        const r = await executeRoute(url, request, glob, timeout)
        result = r.result
        event = r.event
    } catch (err) {
        console.error('[devix] render error:', err)
        return {
            statusCode: 500,
            headers: {},
            error: {statusCode: 500, message: 'Internal Server Error'},
            queryHydration: {},
            params: {},
            metadata: null,
            lang: 'en',
        }
    }

    if (!result) {
        return {
            statusCode: 404,
            headers: {},
            queryHydration: {},
            params: {},
            metadata: null,
            lang: 'en',
        }
    }

    if ('redirect' in result) {
        return {
            statusCode: result.redirectStatus,
            headers: {Location: result.redirect},
            redirect: {url: result.redirect, status: result.redirectStatus, replace: result.redirectReplace},
            queryHydration: {},
            params: {},
            metadata: null,
            lang: 'en',
        }
    }

    if ('error' in result) {
        return {
            statusCode: 500,
            headers: {},
            error: errorToBody(result.error as { statusCode: number; message: string; code?: string; data?: unknown }),
            queryHydration: {},
            params: {},
            metadata: null,
            lang: 'en',
        }
    }

    const {pageMod, layoutMods, params, guardData, metadata, viewport, lang} = result

    // Build the same head/tail and render the page so any `useQuery` calls
    // execute on the server and populate `event.queryHydration`. We then
    // consume the stream (its bytes are discarded) and return the data.
    const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

    const turboStr = await collectEncode({
        GUARD_DATA: guardData ?? null,
    })
    const syncB64 = stringToBase64(turboStr)
    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry,
    })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};</script>`
    const clientScript = `<script type="module" src="${clientEntry}"></script>`
    const customHeaders: Record<string, string> = pageMod.headers ?? {}

    const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">`
    const tail = `</div>${clientScript}</body></html>`

    await runWithRequestEvent(event!, async () => {
        const { stream } = await createHtmlStream(
            createElement(ServerApp, {
                pathname,
                params,
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
            },
        )
        // Consume the stream so React 19 fully resolves every Suspense boundary
        // and every `useQuery` callback runs. The HTML bytes are discarded; we
        // only care about the side effect of populating `event.queryHydration`.
        for await (const _ of stream) {
            // drain
        }
    })

    const queryHydration: Record<string, unknown> = {}
    if (event!.queryHydration) {
        for (const [k, v] of event!.queryHydration) queryHydration[k] = v
    }

    return {
        statusCode: 200,
        headers: customHeaders,
        guardData,
        params,
        metadata,
        viewport,
        lang,
        queryHydration,
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

        if ('error' in result) {
            const err = result.error as { statusCode: number; message: string }
            throw new Error(`devix: route returned error — status ${err.statusCode ?? 500}: ${err.message}`)
        }

        const {pageMod, layoutMods, params, guardData, metadata, viewport, lang} = result

        const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

        const turboStr = await collectEncode({
            GUARD_DATA: guardData ?? null,
        })
        const syncB64 = stringToBase64(turboStr)
        const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
            metadata,
            viewport,
            clientEntry,
        })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};</script>`

        const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">`
        const tail = `</div></body></html>`

        const {stream} = await createHtmlStream(
            createElement(ServerApp, {
                pathname,
                params,
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