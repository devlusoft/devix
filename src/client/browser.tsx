import {hydrate} from 'solid-js/web'
import {RouterProvider} from '@devlusoft/devix'
import {initClientQueryCache} from '../runtime/query-client'

declare global {
    interface Window {
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

    initClientQueryCache()
    const matched = matchClientRoute(window.location.pathname)

    if (window.__LOADER_ERROR__) {
        const {statusCode, message, code, data} = window.__LOADER_ERROR__
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        hydrate(() => (
            <RouterProvider
                matchClientRoute={matchClientRoute}
                loadErrorPage={loadErrorPage}
                getDefaultErrorPage={getDefaultErrorPage}
                initialParams={{}}
                initialPage={() => null}
                initialError={{statusCode, message, code, data}}
                initialErrorPage={ErrorPage}
            />
        ), root)
    } else if (matched) {
        const [pageMod, ...layoutMods] = await Promise.all([
            matched.load(),
            ...matched.loadLayouts.map(l => l()),
        ])

        hydrate(() => (
            <RouterProvider
                matchClientRoute={matchClientRoute}
                loadErrorPage={loadErrorPage}
                getDefaultErrorPage={getDefaultErrorPage}
                initialParams={matched.params}
                initialPage={pageMod.default}
                initialLayouts={layoutMods.map(m => m.default)}
            />
        ), root)

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
                initialParams={{}}
                initialPage={() => null}
                initialLayouts={[]}
                initialError={{statusCode: 404, message: 'Not found'}}
                initialErrorPage={ErrorPage}
            />
        ), root)
    }
}
