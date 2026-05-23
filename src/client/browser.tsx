import {hydrate} from 'solid-js/web'
import {RouterProvider, decodeTurbo, decodeResponse} from '@devlusoft/devix'
import {initClientQueryCache, hydrateClientCache} from '../runtime/query-client'

declare global {
    interface Window {
        __DEVIX__?: {
            metadata: any
            viewport: any
            clientEntry: any
        }
        __DEVIX_TURBO__?: string
        __DEVIX_DEFERRED__?: string[]
        __DEVIX_QUERIES__?: Record<string, unknown>
        __LOADER_ERROR__?: {
            statusCode: number
            message: string
            code?: string
            data?: unknown
        }
    }
}

interface MatchResult {
    load: () => Promise<any>
    loadLayouts: Array<() => Promise<any>>
    params: Record<string, string>
}

interface BootstrapOptions {
    matchClientRoute: (path: string) => MatchResult | null
    loadErrorPage: () => Promise<any>
    getDefaultErrorPage: () => any
}

export async function bootstrap({matchClientRoute, loadErrorPage, getDefaultErrorPage}: BootstrapOptions) {
    const root = document.getElementById('devix-root')!

    if (!window.__DEVIX__) {
        const ErrorPage = getDefaultErrorPage()
        hydrate(() => <ErrorPage statusCode={500} message="Server error" />, root)
        return
    }

    const {metadata, viewport, clientEntry} = window.__DEVIX__
    let loaderData: any
    let layoutsData: any[] = []
    let guardData: any = null

    if (window.__DEVIX_TURBO__) {
        const value: any = await decodeTurbo(new ReadableStream({
            start(controller) {
                controller.enqueue(atob(window.__DEVIX_TURBO__!))
                controller.close()
            }
        }))
        loaderData = value.LOADER_DATA
        layoutsData = value.LAYOUTS_DATA ?? []
        guardData = value.GUARD_DATA ?? null
    }

    initClientQueryCache()
    if (window.__DEVIX_QUERIES__) {
        hydrateClientCache(window.__DEVIX_QUERIES__)
    }

    const deferredKeys = window.__DEVIX_DEFERRED__ ?? []
    const deferredResolvers: Record<string, (v: unknown) => void> = {}
    const deferredPromises: Record<string, Promise<unknown>> = {}
    for (const key of deferredKeys) {
        deferredPromises[key] = new Promise(r => {deferredResolvers[key] = r})
    }

    if (loaderData && typeof loaderData === 'object' && deferredKeys.length > 0) {
        loaderData = Object.assign({}, loaderData, deferredPromises)
    }

    const matched = matchClientRoute(window.location.pathname)

    if (window.__LOADER_ERROR__) {
        const {statusCode, message, code, data} = window.__LOADER_ERROR__
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        hydrate(() => (
            <RouterProvider
                matchClientRoute={matchClientRoute}
                loadErrorPage={loadErrorPage}
                getDefaultErrorPage={getDefaultErrorPage}
                clientEntry={clientEntry}
                initialData={null}
                initialParams={{}}
                initialPage={() => null}
                initialError={{statusCode, message, code, data}}
                initialErrorPage={ErrorPage}
            />
        ), root)
    } else     if (matched) {
        const [pageMod, ...layoutMods] = await Promise.all([
            matched.load(),
            ...matched.loadLayouts.map(l => l()),
        ])

        hydrate(() => (
            <RouterProvider
                matchClientRoute={matchClientRoute}
                loadErrorPage={loadErrorPage}
                getDefaultErrorPage={getDefaultErrorPage}
                clientEntry={clientEntry}
                initialData={loaderData}
                initialParams={matched.params}
                initialPage={pageMod.default}
                initialLayouts={layoutMods.map(m => m.default)}
                initialLayoutsData={layoutsData}
                initialGuardData={guardData}
                initialMeta={metadata}
                initialViewport={viewport}
            />
        ), root)

        if (deferredKeys.length > 0) {
            fetch('/_devix/data' + window.location.pathname)
                .then(async res => {
                    if (!res.ok) return
                    const data: any = await decodeResponse(res)
                    for (const key of deferredKeys) {
                        if (key in data.loaderData) {
                            const value = await data.loaderData[key]
                            deferredResolvers[key](value)
                        }
                    }
                })
                .catch(() => {})
        }

        if (window.location.hash) {
            const id = window.location.hash.slice(1)
            const scrollBehavior = getComputedStyle(document.documentElement).scrollBehavior
            requestAnimationFrame(() => {
                document.getElementById(id)?.scrollIntoView({behavior: scrollBehavior as ScrollBehavior})
            })
        }
    } else {
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        hydrate(() => (
            <RouterProvider
                matchClientRoute={matchClientRoute}
                loadErrorPage={loadErrorPage}
                getDefaultErrorPage={getDefaultErrorPage}
                clientEntry={clientEntry}
                initialData={null}
                initialParams={{}}
                initialPage={() => null}
                initialLayouts={[]}
                initialLayoutsData={[]}
                initialMeta={null}
                initialError={{statusCode: 404, message: 'Not found'}}
                initialErrorPage={ErrorPage}
            />
        ), root)
    }
}
