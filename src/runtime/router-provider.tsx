import {ComponentType, ReactNode, Suspense, useCallback, useContext, useEffect, useRef, useState} from "react";
import {ErrorProps, LayoutProps, PageProps} from "../server/types";
import {Metadata, Viewport} from "../types";
import { invalidateQueries } from "./query-client";

const DEFAULT_VIEWPORT: Viewport = {width: 'device-width', initialScale: 1}
import {HeadSlot} from "./head";
import {NavigateOptions, PageMetaContext, RouteDataContext, RouterContext} from "./context";
import {DevixErrorBoundary} from "./error-boundary";
import {resolveTo} from "./url";
import type {Redirect} from "../utils/response";
import {decodeResponse} from "../utils/turbo-serializer";

export interface ClientRouteMatcher {
    matchClientRoute: (pathname: string) => {
        load: () => Promise<any>
        loadLayouts: (() => Promise<any>)[]
        params: Record<string, string>
    } | null
    loadErrorPage: () => Promise<ComponentType<ErrorProps> | null>
    getDefaultErrorPage: () => ComponentType<ErrorProps> | null
}

interface RouteState {
    pathname: string
    params: Record<string, string>
    loaderData: unknown
    layoutsData: unknown[]
    guardData: unknown
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

/**
 * @deprecated since 0.9.0-alpha.2. `useLoaderData()` reads from the route-level `loader()`. Replace with `useQuery(() => getThing())` inside your component. See `docs/queries.md`.
 */
export function useLoaderData<T>() {
    const ctx = useContext(RouteDataContext)
    if (!ctx) throw new Error("useLoaderData must be used within a route or layout")
    return ctx.loaderData as LoaderReturnType<T>
}

type GuardDataReturn<TGuard> =
    TGuard extends (...args: any[]) => infer R
        ? Exclude<Awaited<R>, string | Redirect | null | undefined | {
            readonly statusCode: number;
            readonly message: string
        }>
        : unknown

/**
 * Devuelve el `guardData` resuelto en el último guard que retornó un objeto
 * (layout → page, en orden). Tipado al retorno del guard si pasas `typeof guard`.
 *
 * ```ts
 * export async function guard({ request }: LoaderContext) {
 *   const session = await getSession(request)
 *   if (!session) return '/login'
 *   return session
 * }
 *
 * function Header() {
 *   const session = useGuardData<typeof guard>()
 *   return <span>{session.user.name}</span>
 * }
 * ```
 */
export function useGuardData<TGuard = unknown>(): GuardDataReturn<TGuard> {
    const ctx = useContext(RouterContext)
    if (!ctx) throw new Error("useGuardData must be used within a route or layout")
    return ctx.guardData as GuardDataReturn<TGuard>
}

export function useDeferred<T>(value: T | Promise<T>): T | undefined {
    const [state, setState] = useState<T | undefined>(
        () => value instanceof Promise ? undefined : value
    )

    useEffect(() => {
        if (value instanceof Promise) {
            let cancelled = false
            value.then(v => {
                if (!cancelled) setState(v)
            })
            return () => {
                cancelled = true
            }
        }
    }, [value])

    return state
}

interface PrefetchEntry {
    promise: Promise<{ pageMod: any; layoutMods: any[]; data: any } | null>
    controller: AbortController
}

interface RouterProviderProps extends ClientRouteMatcher {
    initialData: unknown
    initialParams: Record<string, string>
    initialPage: ComponentType<PageProps>
    initialLayouts?: ComponentType<LayoutProps>[]
    initialLayoutsData?: unknown[]
    initialGuardData?: unknown
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
                                   initialGuardData = null,
                                   initialMeta,
                                   initialViewport,
                                   initialError,
                                   initialErrorPage,
                                   clientEntry,
                                   matchClientRoute,
                                   loadErrorPage,
                                   getDefaultErrorPage,
                               }: RouterProviderProps) {

    const [state, setState] = useState<RouteState>({
        pathname: window.location.pathname,
        params: initialParams,
        loaderData: initialData,
        layoutsData: initialLayoutsData,
        guardData: initialGuardData,
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
        const resolved = resolveTo(href)
        if (resolved.kind === 'external') return

        const key = resolved.href
        if (prefetchCacheRef.current.has(key)) return
        const matched = matchClientRoute(resolved.pathname)
        if (!matched) return

        const controller = new AbortController()
        const promise = Promise.all([
            Promise.all([matched.load(), ...matched.loadLayouts.map(l => l())]),
            fetch(`/_devix/data${key}`, {signal: controller.signal})
        ]).then(async ([[pageMod, ...layoutMods], dataRes]) => {
            if (!dataRes.ok || !pageMod.default) return null
            const data = await decodeResponse(dataRes)
            return {pageMod, layoutMods, data}
        }).catch(() => null)

        const expireTimer = setTimeout(() => {
            controller.abort()
            prefetchCacheRef.current.delete(key)
        }, 3000)
        promise.finally(() => clearTimeout(expireTimer))

        prefetchCacheRef.current.set(key, {promise, controller})
    }, [])

    const loadRoute = useCallback(async (to: string, controller: AbortController) => {
        const pathname = to.split('?')[0].split('#')[0]
        const matched = matchClientRoute(pathname)
        if (!matched) {
            const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
            setState(prev => ({
                ...prev,
                pathname: pathname,
                pendingError: {statusCode: 404, message: 'Not found'},
                ErrorPage: ErrorPage ?? undefined,
            }))
            return
        }

        const cached = prefetchCacheRef.current.get(to)
        if (cached) prefetchCacheRef.current.delete(to)
        const prefetched = cached ? await cached.promise : null

        if (controller.signal.aborted) return

        if (prefetched) {
            const {pageMod, layoutMods, data} = prefetched

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
                guardData: data.guardData ?? null,
                Page: pageMod.default,
                layouts: layoutMods.map(m => m.default),
                metadata: data.metadata ?? null,
                viewport: data.viewport ?? DEFAULT_VIEWPORT,
            })
        } else {
            const pagePromise = matched.load()

            const [layoutMods, dataRes] = await Promise.all([
                Promise.all(matched.loadLayouts.map(l => l())),
                fetch(`/_devix/data${to}`, {signal: controller.signal})
            ])

            if (controller.signal.aborted) return

            if (!dataRes.ok) {
                const ct = dataRes.headers.get('Content-Type') ?? ''
                let errorBody: { statusCode?: number; message?: string; code?: string; data?: unknown } | null = null
                try {
                    if (ct.includes('application/json')) errorBody = await dataRes.json()
                    else if (ct.includes('text/plain')) errorBody = {message: await dataRes.text()}
                } catch {
                }

                const headers: Record<string, string> = {}
                dataRes.headers.forEach((value, key) => {
                    headers[key] = value
                })

                const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
                setState(prev => ({
                    ...prev,
                    pathname,
                    pendingError: {
                        statusCode: errorBody?.statusCode ?? dataRes.status,
                        message: errorBody?.message ?? 'Server error',
                        code: errorBody?.code,
                        data: errorBody?.data,
                        headers,
                    },
                    ErrorPage: ErrorPage ?? undefined,
                }))
                return
            }

            const data = await decodeResponse(dataRes)

            if (data.redirect) {
                if (data.redirectReplace) {
                    window.history.replaceState(null, '', data.redirect)
                } else {
                    window.history.pushState(null, '', data.redirect)
                }
                await loadRoute(data.redirect, controller)
                return
            }

            const Page = (await pagePromise).default

            setState({
                pathname,
                params: data.params ?? {},
                loaderData: data.loaderData,
                layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
                guardData: data.guardData ?? null,
                Page,
                layouts: layoutMods.map(m => m.default),
                metadata: data.metadata ?? null,
                viewport: data.viewport ?? DEFAULT_VIEWPORT,
            })
        }

        const hash = to.includes('#') ? to.split('#')[1] : null
        const scrollBehavior = getComputedStyle(document.documentElement).scrollBehavior as ScrollBehavior
        if (hash) {
            requestAnimationFrame(() => {
                document.getElementById(hash)?.scrollIntoView({behavior: scrollBehavior})
            })
        } else {
            window.scrollTo({top: 0, behavior: scrollBehavior})
        }
    }, [])

    const navigate = useCallback(async (to: string, options?: NavigateOptions) => {
        const resolved = resolveTo(to)
        if (resolved.kind === 'external') {
            window.location.href = resolved.url.href
            return
        }
        const href = resolved.href

        navigatingRef.current?.abort()
        const controller = new AbortController()
        navigatingRef.current = controller

        setIsNavigating(true)
        const run = async () => {
            window.history[options?.replace ? 'replaceState' : 'pushState'](null, '', href)
            await loadRoute(href, controller)
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

    const revalidatingRef = useRef<AbortController | null>(null)

    const revalidate = useCallback(async () => {
        revalidatingRef.current?.abort()
        const controller = new AbortController()
        revalidatingRef.current = controller

        const to = window.location.pathname + window.location.search

        let htmlRes: Response | null = null
        try {
            htmlRes = await fetch(to, { signal: controller.signal })
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            throw err
        }
        if (controller.signal.aborted) return
        if (!htmlRes.ok) return

        const html = await htmlRes.text()
        if (controller.signal.aborted) return

        const match = html.match(/window\.__DEVIX_QUERIES__=({[^<]*});/)
        if (match) {
            try {
                const parsed = JSON.parse(match[1]) as Record<string, unknown>
                ;(window as { __DEVIX_QUERIES__?: Record<string, unknown> }).__DEVIX_QUERIES__ = {
                    ...((window as { __DEVIX_QUERIES__?: Record<string, unknown> }).__DEVIX_QUERIES__ ?? {}),
                    ...parsed,
                }
            } catch {
                /* ignore parse errors */
            }
        }

        if (controller.signal.aborted) return
        invalidateQueries()
        if (controller.signal.aborted) return

        let dataRes: Response
        try {
            dataRes = await fetch(`/_devix/data${to}`, { signal: controller.signal })
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            throw err
        }
        if (controller.signal.aborted) return
        if (!dataRes.ok) return

        const data = await decodeResponse(dataRes)
        if (controller.signal.aborted) return

        if (data.redirect) {
            await navigate(data.redirect, { replace: data.redirectReplace })
            return
        }
        setState(prev => ({
            ...prev,
            loaderData: data.loaderData,
            layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
            guardData: data.guardData ?? null,
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
            <RouteDataContext value={{loaderData: state.loaderData, params: state.params}}>
                <Suspense fallback={null}>
                    <state.Page data={state.loaderData} params={state.params} url={state.pathname}/>
                </Suspense>
            </RouteDataContext>
        )

        for (let i = state.layouts.length - 1; i >= 0; i--) {
            const Layout = state.layouts[i]
            const layoutData = state.layoutsData[i]
            tree = (
                <RouteDataContext value={{loaderData: layoutData, params: state.params}}>
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
            <HeadSlot metadata={state.metadata} viewport={state.viewport}/>
            <RouterContext value={{...state, isNavigating, navigate, revalidate, prefetchRoute}}>
                {content}
            </RouterContext>
        </PageMetaContext>
    )
}

export function Await<T>({resolve, children, fallback}: {
    resolve: Promise<T> | T,
    children: ((value: T) => ReactNode) | ReactNode,
    fallback?: ReactNode
}) {
    let inner: ReactNode
    if (resolve instanceof Promise) {
        if (typeof window === 'undefined') {
            inner = fallback ?? null
        } else {
            inner = <AwaitInner resolve={resolve} children={children} fallback={fallback}/>
        }
    } else {
        inner = typeof children === 'function' ? children(resolve) : children
    }
    return (
        <Suspense fallback={fallback ?? null}>
            {inner}
        </Suspense>
    )
}

function AwaitInner<T>({resolve, children, fallback}: {
    resolve: Promise<T>,
    children: ((value: T) => ReactNode) | ReactNode,
    fallback?: ReactNode
}) {
    const [value, setValue] = useState<T | undefined>(undefined)
    const [error, setError] = useState<unknown>(undefined)

    useEffect(() => {
        let cancelled = false
        resolve.then(
            v => { if (!cancelled) setValue(v) },
            e => { if (!cancelled) setError(e) }
        )
        return () => { cancelled = true }
    }, [resolve])

    if (error) throw error
    if (value !== undefined) {
        return typeof children === 'function' ? children(value) : children
    }
    return fallback ?? null
}