import {renderToString, generateHydrationScript} from "solid-js/web";
import {buildHeadNodes} from '../runtime/head'
import {RouterProvider} from '../runtime/router-provider'
import DefaultError from '../client/default-error'
import {__setFrame} from '../runtime/request-context'
import {buildPages, matchPage, collectLayoutChain, PagesResult} from './pages-router'
import {resolveMetadata, mergeMetadata} from '../runtime/metadata'
import type {PageModule, LayoutModule, PageGlob} from './types'
import type {Manifest} from "vite";
import {escapeAttr, safeJsonStringify} from "../utils/html";
import {isRedirect, isLoaderError, errorToBody} from "../utils/response";
import type {Viewport} from "../types";
import type {ServerBackendConfig} from "../config";
import {makeBoundServer} from "./server-bound";
import {PassThrough} from "node:stream";
import {createHtmlStream} from "./stream-html";
import type {JSX} from 'solid-js/jsx-runtime'
import {runWithQueryCache, QueryCache, initQueryCache} from './query-cache'
import {collectEncode} from "../utils/turbo-serializer";

initQueryCache()


const DEFAULT_VIEWPORT: Viewport = {width: 'device-width', initialScale: 1}

let pagesCache: PagesResult | null = null
let pagesCacheKey: string | null = null

const DEV_CLIENT_ENTRY = '/@id/virtual:devix/entry-client.jsx'

function getManifestAssets(options?: { manifest?: Manifest }): { clientEntry: string, cssLinks: string } {
    const clientEntry = options?.manifest
        ? `/${Object.values(options.manifest).find(chunk => chunk.isEntry)?.file}`
        : DEV_CLIENT_ENTRY

    const cssFiles = options?.manifest
        ? (Object.values(options.manifest).find(chunk => chunk.isEntry)?.css ?? [])
        : []
    const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="/${f}">`).join('')

    return {clientEntry, cssLinks}
}

function extractRedirect(result: unknown): { url: string, status: number, replace: boolean } | null {
    if (typeof result === 'string') return {url: result, status: 302, replace: false}
    if (isRedirect(result)) return {url: result.url, status: result.status, replace: result.replace}
    return null
}

async function resolvePageData(pathname: string, request: Request, glob: PageGlob, serverConfig?: Record<string, ServerBackendConfig>) {
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

    const pageMeta = await resolveMetadata(pageMod, {params, request, guardData, $server})
    const layoutsMeta = await Promise.all(
        layoutMods.map(mod => resolveMetadata(mod, {params, request, guardData, $server}))
    )

    const metadata = mergeMetadata(...layoutsMeta.map(m => m.metadata), pageMeta.metadata)
    const viewport = pageMeta.viewport ?? layoutsMeta.findLast(m => m.viewport)?.viewport ?? DEFAULT_VIEWPORT

    const rootLayoutMod = layoutMods[0]
    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang({params, request, guardData, $server})
        : rootLayoutMod?.lang ?? 'en'

    return {pageMod, layoutMods, params, guardData, metadata, viewport, lang}
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
        return {error: true as const, params: {}, metadata: null, viewport: undefined}
    }

    if (!result) {
        return {params: {}, metadata: null, viewport: undefined}
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

    const {params, guardData, metadata, viewport} = result
    return {
        params,
        guardData,
        metadata,
        viewport,
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

export async function renderDev(url: string, request: Request, glob: PageGlob, options?: {
    manifest?: Manifest,
    server?: Record<string, ServerBackendConfig>
}): Promise<{
    statusCode: number
    headers: Record<string, string>
    html: string
}> {
    const {clientEntry, cssLinks} = getManifestAssets(options)
    const queryCache = new QueryCache()
    const {pathname} = new URL(url, 'http://localhost')

    __setFrame({request, responseHeaders: new Headers()})

    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        result = await runWithQueryCache(
            () => resolvePageData(pathname, request, glob, options?.server),
            queryCache,
            request,
        )
    } catch (err) {
        __setFrame(null)
        console.error('[devix] render error:', err)
        return {statusCode: 500, headers: {}, html: `<html lang="en"><head><meta charset="utf-8"><title>SSR Error</title></head><body></body></html>`}
    }

    if (!result) {
        const errBody = {statusCode: 404 as const, message: 'Not found'}
        const hydrationScript = generateHydrationScript()
        const errorHtml = renderToString(() => <DefaultError statusCode={errBody.statusCode} message={errBody.message} />)
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${hydrationScript}${cssLinks}</head><body><div id="devix-root" data-error="${escapeAttr(safeJsonStringify(errBody))}">${errorHtml}</div>${clientScript}</body></html>`
        return {statusCode: 404, headers: {}, html}
    }

    if ('redirect' in result) {
        const {redirect, redirectStatus} = result as {redirect: string; redirectStatus: number; redirectReplace: boolean}
        return {statusCode: redirectStatus, headers: {Location: redirect}, html: ''}
    }

    if ('loaderError' in result) {
        const errBody = errorToBody(result.loaderError!)
        const hydrationScript = generateHydrationScript()
        const errorContent = renderToString(() => <DefaultError statusCode={errBody.statusCode} message={errBody.message} />)
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${hydrationScript}${cssLinks}</head><body><div id="devix-root" data-error="${escapeAttr(safeJsonStringify(errBody))}">${errorContent}</div>${clientScript}</body></html>`
        return {statusCode: errBody.statusCode, headers: {}, html}
    }

    const {pageMod, layoutMods, params, guardData, metadata, viewport, lang} = result
    const search = new URL(url, 'http://localhost').search

    const content = () => <RouterProvider pathname={pathname} search={search} initialParams={params} initialGuardData={guardData} initialPage={pageMod.default} initialLayouts={layoutMods.map(m => m.default)} />

    const html = renderToString(content)
    __setFrame(null)

    const hydrationScript = generateHydrationScript()
    const headTags = metadata ? renderToString(() => <>{buildHeadNodes(metadata, viewport)}</>) : ''

    const guardEncoded = guardData !== undefined ? await collectEncode(guardData) : ''
    const guardScript = guardEncoded ? `<script id="__DEVIX_GUARD__" type="text/turbo-stream">${guardEncoded}</script>` : ''

    const clientScript = `<script type="module" src="${clientEntry}"></script>`

    const fullHtml = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${hydrationScript}${headTags}${cssLinks}</head><body><div id="devix-root">${html}</div>${guardScript}${clientScript}</body></html>`

    return {statusCode: 200, headers: pageMod.headers ?? {}, html: fullHtml}
}

export async function render(url: string, request: Request, glob: PageGlob, options?: {
    manifest?: Manifest,
    server?: Record<string, ServerBackendConfig>
},): Promise<{ stream: PassThrough, statusCode: number, headers: Record<string, string> }> {
    const {clientEntry, cssLinks} = getManifestAssets(options)
    const queryCache = new QueryCache()
    const {pathname} = new URL(url, 'http://localhost')

    __setFrame({request, responseHeaders: new Headers()})

    let result: Awaited<ReturnType<typeof resolvePageData>>
    try {
        result = await runWithQueryCache(
            () => resolvePageData(pathname, request, glob, options?.server),
            queryCache,
            request,
        )
    } catch (err) {
        __setFrame(null)
        console.error('[devix] render error:', err)
        const stream = new PassThrough()
        stream.end(`<html lang="en"><head><meta charset="utf-8"><title>SSR Error</title></head><body></body></html>`)
        return {stream, statusCode: 500, headers: {}}
    }

    if (!result) {
        const errBody = {statusCode: 404 as const, message: 'Not found'}
        const hydrationScript = generateHydrationScript()
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const errorHtml = renderToString(() => <DefaultError statusCode={errBody.statusCode} message={errBody.message} />)
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${hydrationScript}${cssLinks}</head><body><div id="devix-root" data-error="${escapeAttr(safeJsonStringify(errBody))}">${errorHtml}</div>${clientScript}</body></html>`
        const stream = new PassThrough()
        stream.end(html)
        return {stream, statusCode: 404, headers: {}}
    }

    if ('redirect' in result) {
        const {redirect, redirectStatus, redirectReplace} = result as {
            redirect: string
            redirectStatus: number
            redirectReplace: boolean
        }
        const stream = new PassThrough()
        stream.end('')
        return {stream, statusCode: redirectStatus, headers: {Location: redirect}}
    }

    if ('loaderError' in result) {
        const errBody = errorToBody(result.loaderError!)
        const hydrationScript = generateHydrationScript()
        const clientScript = `<script type="module" src="${clientEntry}"></script>`
        const errorContent = renderToString(() => <DefaultError statusCode={errBody.statusCode} message={errBody.message} />)
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${hydrationScript}${cssLinks}</head><body><div id="devix-root" data-error="${escapeAttr(safeJsonStringify(errBody))}">${errorContent}</div>${clientScript}</body></html>`
        const stream = new PassThrough()
        stream.end(html)
        return {stream, statusCode: errBody.statusCode, headers: {}}
    }

    const {pageMod, layoutMods, params, guardData, metadata, viewport, lang} = result
    const search = new URL(url, 'http://localhost').search

    const headTags = metadata ? renderToString(() => <>{buildHeadNodes(metadata, viewport)}</>) : ''
    const hydrationScript = generateHydrationScript()

    const guardEncoded = guardData !== undefined ? await collectEncode(guardData) : ''
    const guardScript = guardEncoded ? `<script id="__DEVIX_GUARD__" type="text/turbo-stream">${guardEncoded}</script>` : ''

    const head = `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">${hydrationScript}${headTags}${cssLinks}</head><body><div id="devix-root">`
    const tail = `</div>${guardScript}</body></html>`

    const content = () => <RouterProvider pathname={pathname} search={search} initialParams={params} initialGuardData={guardData} initialPage={pageMod.default} initialLayouts={layoutMods.map(m => m.default)} />

    const {stream} = runWithQueryCache(
        () => createHtmlStream(
            content,
            head,
            tail,
            {
                bootstrapModules: [clientEntry],
                onError: (err) => {
                    console.error('[devix] Streaming error:', err)
                    __setFrame(null)
                },
            },
        ),
        queryCache,
        request,
    )

    const cleanup = () => {
        __setFrame(null)
    }
    stream.on('end', cleanup)
    stream.on('close', cleanup)
    return {stream, statusCode: 200, headers: pageMod.headers ?? {}}
}