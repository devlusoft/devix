import { ComponentType, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { RouterContext } from 'virtual:devix/context'
import { ErrorProps, LayoutProps, PageProps } from "../server/types";
import { Metadata, Viewport } from "../types";
import { getDefaultErrorPage, loadErrorPage, matchClientRoute } from "virtual:devix/client-routes";
import { HeadSlot } from "./head";
import { NavigateOptions, PageMetaContext, RouteDataContext } from "./context";
import { DevixErrorBoundary } from "./error-boundary";
import type { Redirect } from "../utils/response";

interface RouteState {
    pathname: string
    params: Record<string, string>
    loaderData: unknown
    layoutsData: unknown[]
    Page: ComponentType<PageProps>
    layouts: ComponentType<LayoutProps>[]
    metadata: Metadata | null
    viewport?: Viewport
    pendingError?: ErrorProps
    ErrorPage?: ComponentType<ErrorProps>
}

export function useRouter() {
    return useContext(RouterContext)
}

const noopNavigate = () => Promise.resolve()
const noopRevalidate = () => Promise.resolve()

export function useNavigate() {
    const ctx = useContext(RouterContext)
    return ctx?.navigate ?? noopNavigate
}

export function useRevalidate() {
    const ctx = useContext(RouterContext)
    return ctx?.revalidate ?? noopRevalidate
}

export function useParams<T extends Record<string, string>>() {
    const ctx = useContext(RouteDataContext)
    if (!ctx) throw new Error("useParams must be used within a route or layout")
    return ctx.params as T
}

type LoaderReturnType<T> = T extends (...args: any[]) => Promise<infer R>
    ? [Exclude<R, Redirect | void | undefined>] extends [never] ? undefined : Exclude<R, Redirect | void | undefined>
    : T extends (...args: any[]) => infer R
    ? [Exclude<R, Redirect | void | undefined>] extends [never] ? undefined : Exclude<R, Redirect | void | undefined>
    : T

export function useLoaderData<T>() {
    const ctx = useContext(RouteDataContext)
    if (!ctx) throw new Error("useLoaderData must be used within a route or layout")
    return ctx.loaderData as LoaderReturnType<T>
}

interface PrefetchEntry {
    promise: Promise<{ pageMod: any; layoutMods: any[]; data: any } | null>
    controller: AbortController
}

interface RouterProviderProps {
    initialData: unknown
    initialParams: Record<string, string>
    initialPage: ComponentType<PageProps>
    initialLayouts?: ComponentType<LayoutProps>[]
    initialLayoutsData?: unknown[]
    initialMeta?: Metadata | null
    initialViewport?: Viewport
    initialError?: ErrorProps
    initialErrorPage?: ComponentType<ErrorProps>
    clientEntry: string
}

export function RouterProvider({
    initialData,
    initialParams,
    initialPage,
    initialLayouts = [],
    initialLayoutsData = [],
    initialMeta,
    initialViewport,
    initialError,
    initialErrorPage,
    clientEntry,
}: RouterProviderProps) {

    const [state, setState] = useState<RouteState>({
        pathname: window.location.pathname,
        params: initialParams,
        loaderData: initialData,
        layoutsData: initialLayoutsData,
        Page: initialPage,
        layouts: initialLayouts,
        metadata: initialMeta ?? null,
        viewport: initialViewport,
        pendingError: initialError,
        ErrorPage: initialErrorPage,
    })

    const navigatingRef = useRef<AbortController | null>(null)
    const [isNavigating, setIsNavigating] = useState(false)

    const prefetchCacheRef = useRef<Map<string, PrefetchEntry>>(new Map())

    const prefetchRoute = useCallback((href: string) => {
        if (prefetchCacheRef.current.has(href)) return
        const pathname = href.split('?')[0].split('#')[0]
        const matched = matchClientRoute(pathname)
        if (!matched) return

        const controller = new AbortController()
        const promise = Promise.all([
            Promise.all([matched.load(), ...matched.loadLayouts.map(l => l())]),
            fetch(`/_data${href}`, { headers: { Accept: 'application/json' }, signal: controller.signal })
        ]).then(async ([[pageMod, ...layoutMods], dataRes]) => {
            if (!dataRes.ok || !pageMod.default) return null
            const data = await dataRes.json()
            return { pageMod, layoutMods, data }
        }).catch(() => null)

        const expireTimer = setTimeout(() => {
            controller.abort()
            prefetchCacheRef.current.delete(href)
        }, 3000)
        promise.finally(() => clearTimeout(expireTimer))

        prefetchCacheRef.current.set(href, { promise, controller })
    }, [])

    const loadRoute = useCallback(async (to: string, controller: AbortController) => {
        const pathname = to.split('?')[0].split('#')[0]
        const matched = matchClientRoute(pathname)
        if (!matched) {
            const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
            setState(prev => ({
                ...prev,
                pathname: pathname,
                pendingError: { statusCode: 404, message: 'Not found' },
                ErrorPage: ErrorPage ?? undefined,
            }))
            return
        }

        const cached = prefetchCacheRef.current.get(to)
        if (cached) prefetchCacheRef.current.delete(to)
        const prefetched = cached ? await cached.promise : null

        if (controller.signal.aborted) return

        let pageMod: any, layoutMods: any[], data: any

        if (prefetched) {
            ;({ pageMod, layoutMods, data } = prefetched)
        } else {
            const [[pm, ...lm], dataRes] = await Promise.all([
                Promise.all([
                    matched.load(),
                    ...matched.loadLayouts.map(l => l()),
                ]),
                fetch(`/_data${to}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                })
            ])

            if (controller.signal.aborted) return
            if (!pm.default) return

            if (!dataRes.ok) {
                const ct = dataRes.headers.get('Content-Type') ?? ''
                let errorBody: { statusCode?: number; message?: string; data?: unknown } | null = null
                try {
                    if (ct.includes('application/json')) errorBody = await dataRes.json()
                    else if (ct.includes('text/plain')) errorBody = { message: await dataRes.text() }
                } catch { /* ignorar errores de parsing */ }

                const headers: Record<string, string> = {}
                dataRes.headers.forEach((value, key) => { headers[key] = value })

                const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
                setState(prev => ({
                    ...prev,
                    pathname,
                    pendingError: {
                        statusCode: errorBody?.statusCode ?? dataRes.status,
                        message: errorBody?.message ?? 'Server error',
                        data: errorBody?.data,
                        headers,
                    },
                    ErrorPage: ErrorPage ?? undefined,
                }))
                return
            }

            pageMod = pm
            layoutMods = lm
            data = await dataRes.json()
        }

        if (data.redirect) {
            if (data.redirectReplace) {
                window.history.replaceState(null, '', data.redirect)
            } else {
                window.history.pushState(null, '', data.redirect)
            }
            await loadRoute(data.redirect, controller)
            return
        }

        setState({
            pathname,
            params: data.params ?? {},
            loaderData: data.loaderData,
            layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
            Page: pageMod.default,
            layouts: layoutMods.map(m => m.default),
            metadata: data.metadata ?? null,
            viewport: data.viewport,
        })

        const hash = to.includes('#') ? to.split('#')[1] : null
        const scrollBehavior = getComputedStyle(document.documentElement).scrollBehavior as ScrollBehavior
        if (hash) {
            requestAnimationFrame(() => {
                document.getElementById(hash)?.scrollIntoView({ behavior: scrollBehavior })
            })
        } else {
            window.scrollTo({ top: 0, behavior: scrollBehavior })
        }
    }, [])

    const navigate = useCallback(async (to: string, options?: NavigateOptions) => {
        navigatingRef.current?.abort()
        const controller = new AbortController()
        navigatingRef.current = controller

        setIsNavigating(true)
        const run = async () => {
            window.history[options?.replace ? 'replaceState' : 'pushState'](null, '', to)
            await loadRoute(to, controller)
        }
        try {
            if (options?.viewTransition && 'startViewTransition' in document) {
                await (document as any).startViewTransition(run).finished
            } else {
                await run()
            }
        } finally {
            if (!controller.signal.aborted) setIsNavigating(false)
        }
    }, [loadRoute])

    const revalidate = useCallback(async () => {
        const to = window.location.pathname + window.location.search
        const controller = new AbortController()
        const dataRes = await fetch(`/_data${to}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
        if (!dataRes.ok) return
        const data = await dataRes.json()
        if (data.redirect) {
            await navigate(data.redirect, { replace: data.redirectReplace })
            return
        }
        setState(prev => ({
            ...prev,
            loaderData: data.loaderData,
            layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
            params: data.params ?? prev.params,
            metadata: data.metadata ?? prev.metadata,
            viewport: data.viewport ?? prev.viewport,
        }))
    }, [navigate])

    useEffect(() => {
        const handlePop = () => {
            navigatingRef.current?.abort()
            const controller = new AbortController()
            navigatingRef.current = controller

            const to = window.location.pathname + window.location.search
            loadRoute(to, controller).catch(err => {
                if (err.name !== 'AbortError') console.error('[router] popstate error:', err)
            })
        }
        window.addEventListener("popstate", handlePop)
        return () => window.removeEventListener("popstate", handlePop)
    }, [loadRoute])

    let content: ReactNode

    if (state.pendingError) {
        content = state.ErrorPage
            ? <state.ErrorPage {...state.pendingError} />
            : <h1>{state.pendingError.statusCode}</h1>
    } else {
        let tree: ReactNode = (
            <RouteDataContext value={{ loaderData: state.loaderData, params: state.params }}>
                <state.Page data={state.loaderData} params={state.params} url={state.pathname} />
            </RouteDataContext>
        )

        for (let i = state.layouts.length - 1; i >= 0; i--) {
            const Layout = state.layouts[i]
            const layoutData = state.layoutsData[i]
            tree = (
                <RouteDataContext value={{ loaderData: layoutData, params: state.params }}>
                    <Layout data={layoutData} params={state.params}>{tree}</Layout>
                </RouteDataContext>
            )
        }

        content = (
            <DevixErrorBoundary key={state.pathname} ErrorPage={state.ErrorPage}>
                {tree}
            </DevixErrorBoundary>
        )
    }

    return (
        <PageMetaContext value={{
            metadata: state.metadata,
            viewport: state.viewport,
            clientEntry,
        }}>
            <HeadSlot metadata={state.metadata} viewport={state.viewport} />
            <RouterContext value={{ ...state, isNavigating, navigate, revalidate, prefetchRoute }}>
                {content}
            </RouterContext>
        </PageMetaContext>
    )
}