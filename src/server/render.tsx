import {ComponentType, createElement, ReactElement} from 'react'
import {renderToString, renderToStaticMarkup} from 'react-dom/server'
import {buildHeadNodes} from '../runtime/head'
import {buildPages, matchPage, collectLayoutChain} from './pages-router'
import {resolveMetadata, mergeMetadata} from '../runtime/metadata'
import {RouteDataContext} from '../runtime/context'
import type {PageModule, LayoutModule, PageGlob} from './types'
import type {Manifest} from "vite";
import {escapeAttr, safeJsonStringify} from "../utils/html";
import {withTimeout} from "../utils/async";

const DEV_CLIENT_ENTRY = '/@id/virtual:devix/entry-client'

async function resolvePageData(pathname: string, request: Request, glob: PageGlob, timeout: number) {
    const {pages, layouts} = buildPages(Object.keys(glob.pages), Object.keys(glob.layouts), glob.pagesDir)
    const matched = matchPage(pathname, pages)
    if (!matched) return null

    const {page, params} = matched
    const layoutChain = collectLayoutChain(page.key, layouts)
    const ctx = {params, request}

    const pageMod = await glob.pages[page.key]() as PageModule

    if (pageMod.guard) {
        const redirect = await pageMod.guard(ctx)
        if (redirect) return {redirect}
    }

    const loaderData = pageMod.loader
        ? await withTimeout(pageMod.loader(ctx) as Promise<unknown>, timeout)
        : null

    const layoutMods = await Promise.all(
        layoutChain.map(l => glob.layouts[l.key]() as Promise<LayoutModule>)
    )
    const layoutsData = await withTimeout(
        Promise.all(layoutMods.map(mod => mod.loader ? mod.loader(ctx) : null)),
        timeout
    )

    const pageMeta = await resolveMetadata(pageMod, {...ctx, loaderData})
    const layoutsMeta = await Promise.all(
        layoutMods.map((mod, i) => resolveMetadata(mod, {...ctx, loaderData: layoutsData[i]}))
    )

    const metadata = mergeMetadata(...layoutsMeta.map(m => m.metadata), pageMeta.metadata)
    const viewport = pageMeta.viewport ?? layoutsMeta.findLast(m => m.viewport)?.viewport

    const rootLayoutMod = layoutMods[0]
    const lang = rootLayoutMod?.generateLang
        ? await rootLayoutMod.generateLang({...ctx, loaderData})
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
        return {loaderData: null, params: {}, layouts: [], metadata: null, viewport: undefined}
    }

    if (!result || 'redirect' in result) {
        return {loaderData: null, params: {}, layouts: [], metadata: null, viewport: undefined}
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
        return {html: '', statusCode: 302, headers: {Location: result.redirect}}
    }

    const {pageMod, layoutMods, params, loaderData, layoutsData, metadata, viewport, lang} = result

    let tree: ReactElement = createElement(
        RouteDataContext as any,
        {value: {loaderData, params}},
        createElement(pageMod.default, {data: loaderData, params, url: pathname})
    )

    for (let i = layoutMods.length - 1; i >= 0; i--) {
        const layoutData = layoutsData[i]
        tree = createElement(
            RouteDataContext as any,
            {value: {loaderData: layoutData, params}},
            createElement(layoutMods[i].default as ComponentType<any>, {data: layoutData, params}, tree),
        )
    }

    const content = renderToString(tree)
    const headTags = metadata ? renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any) : ''

    const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
        metadata,
        viewport,
        clientEntry
    })};window.__LOADER_DATA__=${safeJsonStringify(loaderData)};window.__LAYOUTS_DATA__=${safeJsonStringify(layoutsData)};</script>`
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

