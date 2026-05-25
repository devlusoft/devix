import {hydrate} from 'solid-js/web'
import {RouterProvider} from '@devlusoft/devix'
import {initClientQueryCache} from '../runtime/query-client'
import {decode} from 'turbo-stream'

interface LoaderError {
    statusCode: number
    message: string
    code?: string
    data?: unknown
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

async function decodeGuardData(): Promise<unknown> {
    const el = document.getElementById('__DEVIX_GUARD__')
    if (!el?.textContent) return undefined
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(el.textContent!)
            controller.close()
        }
    })
    return await decode(stream)
}

export async function bootstrap({matchClientRoute, loadErrorPage, getDefaultErrorPage}: BootstrapOptions) {
    const root = document.getElementById('devix-root')!
    const errorAttr = root.getAttribute('data-error')
    const initialError: LoaderError | null = errorAttr ? JSON.parse(errorAttr) : null
    const initialGuardData = await decodeGuardData()

    initClientQueryCache()
    const matched = matchClientRoute(window.location.pathname)

    if (initialError || !matched) {
        const error = initialError ?? {statusCode: 404, message: 'Not found'} as const
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        hydrate(() => (
            <RouterProvider
                matchClientRoute={matchClientRoute}
                loadErrorPage={loadErrorPage}
                getDefaultErrorPage={getDefaultErrorPage}
                initialParams={{}}
                initialPage={() => null}
                initialError={error}
                initialErrorPage={ErrorPage}
            />
        ), root)
        return
    }

    const [pageMod, ...layoutMods] = await Promise.all([
        matched.load(),
        ...matched.loadLayouts.map(l => l()),
    ])

    hydrate(() => (
        <RouterProvider
            matchClientRoute={matchClientRoute}
            loadErrorPage={loadErrorPage}
            getDefaultErrorPage={getDefaultErrorPage}
            initialGuardData={initialGuardData}
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
}
