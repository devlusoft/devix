import {renderToString, generateHydrationScript} from "solid-js/web";
import {buildHeadNodes} from '../runtime/head'
import {ServerApp} from '../runtime/server-app'
import {buildPages, matchPage, collectLayoutChain, PagesResult} from './pages-router'
import {resolveMetadata, mergeMetadata} from '../runtime/metadata'
import type {PageModule, LayoutModule, PageGlob} from './types'
import type {Manifest} from "vite";
import {escapeAttr, safeJsonStringify} from "../utils/html";
import {withTimeout} from "../utils/async";
import {collectEncode, stringToBase64} from "../utils/turbo-serializer";
import {isRedirect, isLoaderError, errorToBody, NotFoundError, RedirectError, LoaderError} from "../utils/response";
import type {Viewport} from "../types";
import type {ServerBackendConfig} from "../config";
import {makeBoundServer} from "./server-bound";
import {PassThrough} from "node:stream";
import {createHtmlStream} from "./stream-html";
import {runWithQueryCache, QueryCache, initQueryCache} from './query-cache'

initQueryCache()


const DEFAULT_VIEWPORT: Viewport = {width: 'device-width', initialScale: 1}

let pagesCache: PagesResult | null = null
let pagesCacheKey: string | null = null

const DEV_CLIENT_ENTRY = '/@id/virtual:devix/entry-client.jsx'

function extractRedirect(result: unknown): { url: string, status: number, replace: boolean } | null {
    if (typeof result === 'string') return {url: result, status: 302, replace: false}
    if (isRedirect(result)) return {url: result.url, status: result.status, replace: result.replace}
    return null
}

async function resolvePageData(pathname: string, request: Request, glob: PageGlob, timeout: number, serverConfig?: Record<string, ServerBackendConfig>) {
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
    const $server = makeBoundServer(request, serverConfig)

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

    const ctx = {params, request, guardData, $server}

    const rawLoaderData = pageMod.loader
        ? await withTimeout(Promise.resolve(pageMod.loader(ctx)), timeout)
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
    const viewport = pageMeta.viewport ?? layoutsMeta.findLast(m => m.viewport)?.viewport ?? DEFAULT_VIEWPORT

    const rootLayoutMod = layoutMods[0]
    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang({...ctx, loaderData: layoutsData[0]})
        : rootLayoutMod?.lang ?? 'en'

    return {pageMod, layoutMods, params, loaderData, layoutsData, guardData, metadata, viewport, lang}
}

export async function runLoader(url: string, request: Request, glob: PageGlob, options?: {
    loaderTimeout?: number;
    server?: Record<string, ServerBackendConfig>
}) {
    const {pathname} = new URL(url, 'http://localhost')
    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        const timeout = options?.loaderTimeout ?? 10_000
        result = await resolvePageData(pathname, request, glob, timeout, options?.server)
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
        layouts: layoutsData.map(loaderData => ({loaderData})),
        guardData,
        metadata,
        viewport,
    }
}

export async function render(
    url: string,
    request: Request,
    glob: PageGlob,
    options?: { manifest?: Manifest, loaderTimeout?: number, server?: Record<string, ServerBackendConfig> },
) {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    const queryCache = new QueryCache()

    const {pathname} = new URL(url, 'http://localhost')

    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        const timeout = options?.loaderTimeout ?? 10_000
        result = await runWithQueryCache(
            () => resolvePageData(pathname, request, glob, timeout, options?.server),
            queryCache
        )
    } catch (err) {
        console.error('[devix] render error:', err)
        const msg = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? (err.stack || '') : ''
        const ov = buildDevErrorOverlay([{message: `Loader crashed: ${msg}`, stack}])
        const html = `<html lang="en"><head><meta charset="utf-8"><title>SSR Error</title></head><body>${ov}</body></html>`
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

    const ssrErrors: SsrError[] = []
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        (globalThis as any).__DEVIX_SSR_ERRORS__ = ssrErrors
    }

    const search = new URL(url, 'http://localhost').search

    let content: string
    let renderFailed = false
    try {
        content = runWithQueryCache(
            () => renderToString(() => <ServerApp pathname={pathname} search={search} params={params} loaderData={loaderData} layoutsData={layoutsData} guardData={guardData} Page={pageMod.default} layouts={layoutMods.map(m => m.default)} metadata={metadata ?? null} viewport={viewport} clientEntry={clientEntry} />),
            queryCache
        )
    } catch (err) {
        renderFailed = true
        content = ''
        const msg = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? (err.stack || '') : ''
        ssrErrors.push({message: `SSR rendering crashed: ${msg}`, stack})
    }

    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        delete (globalThis as any).__DEVIX_SSR_ERRORS__
    }

    trackPromises(loaderData as Record<string, unknown>)
    for (const ld of layoutsData) trackPromises(ld as Record<string, unknown>)

    await Promise.race([
        Promise.allSettled(
            [...Object.values(loaderData ?? {}), ...layoutsData.flatMap(d => Object.values(d ?? {}))]
                .filter(v => v instanceof Promise)
        ),
        new Promise(r => setTimeout(r, 50)),
    ])

    const [syncLoader, deferredLoaderKeys] = separateDeferred(loaderData as Record<string, unknown> | null)
    const syncLayouts = layoutsData.map(d => separateDeferred(d as Record<string, unknown> | null)[0])
    const headTags = metadata ? renderToString(() => <>{buildHeadNodes(metadata, viewport)}</>) : ''
    const hydrationScript = generateHydrationScript()

    const turboStr = await collectEncode({
        LOADER_DATA: syncLoader ?? null,
        LAYOUTS_DATA: syncLayouts,
        GUARD_DATA: guardData ?? null,
    })
    const syncB64 = stringToBase64(turboStr)
    const deferredScript = deferredLoaderKeys?.length
        ? `window.__DEVIX_DEFERRED__=${safeJsonStringify(deferredLoaderKeys)};`
        : ''
    const queryEntries: Record<string, unknown> = {}
    for (const [key, promise] of queryCache.entries()) {
        try {
            queryEntries[key] = await promise
        } catch {}
    }
    const queriesScript = Object.keys(queryEntries).length
        ? `window.__DEVIX_QUERIES__=${safeJsonStringify(queryEntries)};`
        : ''
    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry
    })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};${deferredScript}${queriesScript}</script>`
    const clientScript = `<script type="module" src="${clientEntry}"></script>`
    const customHeaders: Record<string, string> = pageMod.headers ?? {}

    const devOverlay = ssrErrors.length > 0 ? buildDevErrorOverlay(ssrErrors) : ''

    if (renderFailed) {
        const html = `<html lang="en"><head><meta charset="utf-8">${cssLinks}</head><body><div id="devix-root">${content}</div>${devOverlay}</body></html>`
        return {html, statusCode: 500, headers: {}}
    }

    const html = `<html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${hydrationScript}${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">${content}</div>${clientScript}${devOverlay}</body></html>`

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
    server?: Record<string, ServerBackendConfig>
},): Promise<{ stream: PassThrough, statusCode: number, headers: Record<string, string> }> {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    const queryCache = new QueryCache()

    const {pathname} = new URL(url, 'http://localhost')

    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        const timeout = options?.loaderTimeout ?? 10_000
        result = await runWithQueryCache(
            () => resolvePageData(pathname, request, glob, timeout, options?.server),
            queryCache
        )
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
    const search = new URL(url, 'http://localhost').search

    const headTags = metadata ? renderToString(() => <>{buildHeadNodes(metadata, viewport)}</>) : ''

    trackPromises(loaderData as Record<string, unknown>)
    for (const ld of layoutsData) trackPromises(ld as Record<string, unknown>)

    await Promise.race([
        Promise.allSettled(
            [...Object.values(loaderData ?? {}), ...layoutsData.flatMap(d => Object.values(d ?? {}))]
                .filter(v => v instanceof Promise)
        ),
        new Promise(r => setTimeout(r, 50)),
    ])

    const deferredLoaderKeys = getDeferredKeys(loaderData as Record<string, unknown> | null)
    const [syncLoader] = separateDeferred(loaderData as Record<string, unknown> | null)
    const syncLayouts = layoutsData.map(d => separateDeferred(d as Record<string, unknown> | null)[0])

    const turboStr = await collectEncode({
        LOADER_DATA: syncLoader ?? null,
        LAYOUTS_DATA: syncLayouts,
        GUARD_DATA: guardData ?? null,
    })
    const syncB64 = stringToBase64(turboStr)
    const deferredScript = deferredLoaderKeys?.length
        ? `window.__DEVIX_DEFERRED__=${safeJsonStringify(deferredLoaderKeys)};`
        : ''
    const queryEntries: Record<string, unknown> = {}
    for (const [key, promise] of queryCache.entries()) {
        try {
            queryEntries[key] = await promise
        } catch {}
    }
    const queriesScript = Object.keys(queryEntries).length
        ? `window.__DEVIX_QUERIES__=${safeJsonStringify(queryEntries)};`
        : ''
    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry,
    })};window.__DEVIX_TURBO__=${safeJsonStringify(syncB64)};${deferredScript}${queriesScript}</script>`

    const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${headTags}${cssLinks}${dataScript}</head><body><div id="devix-root">`
    const tail = `</div></body></html>`

    const content = () => <ServerApp pathname={pathname} search={search} params={params} loaderData={loaderData} layoutsData={layoutsData} guardData={guardData} Page={pageMod.default} layouts={layoutMods.map(m => m.default)} metadata={metadata ?? null} viewport={viewport} clientEntry={clientEntry} />
    const {stream} = createHtmlStream(
        content,
        head,
        tail,
        {
            bootstrapModules: [clientEntry],
            onError: (err) => console.error('[devix] Streaming error:', err),
        },
    )
    return {stream, statusCode: 200, headers: pageMod.headers ?? {}}
}

function trackPromises(obj: Record<string, unknown>) {
    if (!obj) return
    for (const key of Object.keys(obj)) {
        const value = obj[key]
        if (value instanceof Promise) {
            let settled: { value: unknown } | undefined
            const tracked = value.then(
                v => { settled = {value: v}; return v },
                err => { throw err },
            )
            ;(tracked as any)._dvSettled = () => settled
            obj[key] = tracked
        }
    }
}

function getDeferredKeys<T extends Record<string, unknown>>(obj: T | null | undefined): string[] | null {
    if (!obj) return null
    const deferred: string[] = []
    for (const [key, value] of Object.entries(obj)) {
        if (value instanceof Promise) {
            const s = (value as any)._dvSettled?.()
            if (!s) deferred.push(key)
        }
    }
    return deferred.length > 0 ? deferred : null
}

function separateDeferred<T extends Record<string, unknown>>(obj: T | null | undefined): [T | null, string[] | null] {
    if (!obj) return [null, null]

    const sync: Record<string, unknown> = {}
    const deferred: string[] = []

    for (const [key, value] of Object.entries(obj)) {
        if (value instanceof Promise) {
            const s = (value as any)._dvSettled?.()
            if (s) {
                sync[key] = s.value
            } else {
                deferred.push(key)
            }
        } else {
            sync[key] = value
        }
    }

    return [sync as T, deferred.length > 0 ? deferred : null]
}

interface SsrError {
    message: string
    stack: string
}

function buildDevErrorOverlay(errors: SsrError[]): string {
    return `
<style>
#dov{all:initial;position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.5;color:#1a1a1a;-webkit-font-smoothing:antialiased}
#dov-bg{position:absolute;inset:0;background:rgba(0,0,0,.45)}
#dov-w{position:relative;width:640px;max-width:calc(100vw - 64px);max-height:calc(100vh - 64px);background:#fff;border-radius:6px;box-shadow:0 16px 48px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden}
#dov-h{padding:16px 24px 0;display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;letter-spacing:-.01em;user-select:none}
.dov-dot{width:8px;height:8px;border-radius:50%;background:#dc2626;flex-shrink:0}
.dov-ct{color:#888;font-weight:400}
#dov-b{padding:14px 24px 20px;overflow-y:auto;flex:1;min-height:0}
.dov-msg{font-size:14px;font-weight:500;color:#dc2626;margin:0;padding:10px 14px;background:#fef2f2;border-radius:4px;word-break:break-word;white-space:pre-wrap;line-height:1.4}
.dov-lbl{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:#888;margin:12px 0 4px}
.dov-stk{margin:0;font-family:ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:#333;background:#f5f5f5;padding:12px 14px;border-radius:4px;overflow-x:auto;white-space:pre;tab-size:2;max-height:260px;overflow-y:auto}
.dov-sep{height:1px;background:#e5e5e5;margin:16px 0}
#dov-ft{padding:10px 24px;display:flex;justify-content:flex-end;border-top:1px solid #e5e5e5}
#dov-ft button{padding:5px 16px;border-radius:4px;border:1px solid #d1d1d1;background:#fff;color:#555;cursor:pointer;font-size:12px;font-family:inherit;transition:color .15s,border-color .15s}
#dov-ft button:hover{border-color:#999;color:#1a1a1a}
@media(prefers-color-scheme:dark){
#dov{color:#e0e0e0}
#dov-bg{background:rgba(0,0,0,.6)}
#dov-w{background:#18181b;box-shadow:0 16px 48px rgba(0,0,0,.5)}
.dov-msg{background:#2a1212;color:#f87171}
.dov-stk{background:#1c1c1f;color:#c0c0c0}
.dov-sep{background:#2a2a2d}
#dov-ft{border-color:#2a2a2d}
#dov-ft button{background:#18181b;border-color:#3a3a3d;color:#999}
#dov-ft button:hover{border-color:#666;color:#e0e0e0}
}
</style>
<div id="dov" role="alertdialog" aria-label="SSR Error">
<div id="dov-bg"></div>
<div id="dov-w">
<div id="dov-h"><div class="dov-dot"></div>SSR Error${errors.length > 1 ? `<span class="dov-ct"> &middot; ${errors.length}</span>` : ''}</div>
<div id="dov-b">
${errors.map((e, i) => `
${i > 0 ? '<div class="dov-sep"></div>' : ''}
<div class="dov-msg">${escapeAttr(e.message)}</div>
<div class="dov-lbl">Stack trace</div>
<pre class="dov-stk">${escapeAttr(e.stack || '(no stack)')}</pre>
`).join('')}
</div>
<div id="dov-ft">
<button onclick="document.getElementById('dov').remove()">Dismiss</button>
</div>
</div>
</div>
<script>
document.getElementById('dov').addEventListener('click',function(e){if(e.target===this)this.remove()});
document.addEventListener('keydown',function __d(e){if(e.key==='Escape'){var o=document.getElementById('dov');if(o){o.remove();document.removeEventListener('keydown',__d)}}});
</script>
`
}