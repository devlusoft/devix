import {Component, createEffect, createMemo, createSignal, onCleanup, useContext} from "solid-js";
import type {ErrorProps, LayoutProps, PageProps} from "../server/types";
import type {Metadata, Viewport} from "../types";

const DEFAULT_VIEWPORT: Viewport = {width: 'device-width', initialScale: 1}
import {NavigateOptions, PageMetaContext, RouteDataContext, RouterContext} from "./context";
import {ContentTree} from "./content-tree";
import {resolveTo} from "./url";
import type {Redirect} from "../utils/response";
import {decodeResponse} from "../utils/turbo-serializer";

export interface ClientRouteMatcher {
    matchClientRoute: (pathname: string) => {
        load: () => Promise<any>
        loadLayouts: (() => Promise<any>)[]
        params: Record<string, string>
    } | null
    loadErrorPage: () => Promise<Component<ErrorProps> | null>
    getDefaultErrorPage: () => Component<ErrorProps> | null
}

interface RouteState {
    _navKey: number
    pathname: string
    search: string
    params: Record<string, string>
    loaderData: unknown
    layoutsData: unknown[]
    guardData: unknown
    Page: Component<PageProps>
    layouts: Component<LayoutProps>[]
    metadata: Metadata | null
    viewport?: Viewport
    pendingError?: ErrorProps
    ErrorPage?: Component<ErrorProps>
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

export function useSearchParams(): [() => URLSearchParams, (params: Record<string, string | undefined>) => void] {
    const ctx = useContext(RouterContext)
    const searchParams = createMemo(() => new URLSearchParams(ctx?.search ?? window.location.search))
    const setSearchParams = (params: Record<string, string | undefined>) => {
        const next = new URLSearchParams(ctx?.search ?? window.location.search)
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined) next.delete(key)
            else next.set(key, value)
        }
        const qs = next.toString()
        ctx?.navigate(qs ? `?${qs}` : window.location.pathname, {replace: true})
    }
    return [searchParams, setSearchParams]
}


interface PrefetchEntry {
    promise: Promise<{ pageMod: any; layoutMods: any[]; data: any } | null>
    controller: AbortController
}

interface RouterProviderProps extends ClientRouteMatcher {
    initialData: unknown
    initialParams: Record<string, string>
    initialPage: Component<PageProps>
    initialLayouts?: Component<LayoutProps>[]
    initialLayoutsData?: unknown[]
    initialGuardData?: unknown
    initialMeta?: Metadata | null
    initialViewport?: Viewport
    initialError?: ErrorProps
    initialErrorPage?: Component<ErrorProps>
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

    const [state, setState] = createSignal<RouteState>({
        _navKey: 0,
        pathname: window.location.pathname,
        search: window.location.search,
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

    let navigatingController: AbortController | null = null
    const [isNavigating, setIsNavigating] = createSignal(false)

    const prefetchCache = new Map<string, PrefetchEntry>()

    const prefetchRoute = (href: string) => {
        const resolved = resolveTo(href)
        if (resolved.kind === 'external') return

        const key = resolved.href
        if (prefetchCache.has(key)) return
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
            prefetchCache.delete(key)
        }, 3000)
        promise.finally(() => clearTimeout(expireTimer))

        prefetchCache.set(key, {promise, controller})
    }

    const loadRoute = async (to: string, controller: AbortController) => {
        const pathname = to.split('?')[0].split('#')[0]
        const qsIndex = to.indexOf('?')
        const search = qsIndex !== -1 ? '?' + to.slice(qsIndex + 1).split('#')[0] : ''
        const matched = matchClientRoute(pathname)
        if (!matched) {
            const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
            setState(s => ({
                ...s,
                _navKey: s._navKey + 1,
                pathname,
                search,
                pendingError: {statusCode: 404, message: 'Not found'},
                ErrorPage: ErrorPage ?? undefined,
            }))
            return
        }

        const cached = prefetchCache.get(to)
        if (cached) prefetchCache.delete(to)
        const prefetched = cached ? await cached.promise : null

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

            setState(prev => ({
                _navKey: prev._navKey + 1,
                pathname,
                search,
                params: data.params ?? {},
                loaderData: data.loaderData,
                layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
                guardData: data.guardData ?? null,
                Page: pageMod.default,
                layouts: layoutMods.map(m => m.default),
                metadata: data.metadata ?? null,
                viewport: data.viewport ?? DEFAULT_VIEWPORT,
            }))
        } else {
            const pagePromise = matched.load()

            const [layoutMods, dataRes] = await Promise.all([
                Promise.all(matched.loadLayouts.map(l => l())),
                fetch(`/_devix/data${to}`, {signal: controller.signal}).catch(() => null as Response | null)
            ])

            if (controller.signal.aborted || !dataRes) return

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
                setState(s => ({
                    ...s,
                    _navKey: s._navKey + 1,
                    pathname,
                    search,
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

            let data: any
            try {
                data = await decodeResponse(dataRes)
            } catch {
                const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
                setState(s => ({
                    ...s,
                    _navKey: s._navKey + 1,
                    pathname,
                    search,
                    pendingError: {statusCode: 500, message: 'Failed to decode server response'},
                    ErrorPage: ErrorPage ?? undefined,
                }))
                return
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

            let Page: any
            try {
                Page = (await pagePromise).default
                if (!Page) throw new Error('Page module has no default export')
            } catch (err) {
                const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
                console.error('[router] page load error:', err)
                setState(s => ({
                    ...s,
                    _navKey: s._navKey + 1,
                    pathname,
                    search,
                    pendingError: {statusCode: 500, message: 'Failed to load page module'},
                    ErrorPage: ErrorPage ?? undefined,
                }))
                return
            }

            setState(prev => ({
                _navKey: prev._navKey + 1,
                pathname,
                search,
                params: data.params ?? {},
                loaderData: data.loaderData,
                layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
                guardData: data.guardData ?? null,
                Page,
                layouts: layoutMods.map(m => m.default),
                metadata: data.metadata ?? null,
                viewport: data.viewport ?? DEFAULT_VIEWPORT,
            }))
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
    }

    const navigate = async (to: string, options?: NavigateOptions) => {
        const resolved = resolveTo(to)
        if (resolved.kind === 'external') {
            window.location.href = resolved.url.href
            return
        }
        const href = resolved.href

        navigatingController?.abort()
        const controller = new AbortController()
        navigatingController = controller

        setIsNavigating(() => true)
        try {
            window.history[options?.replace ? 'replaceState' : 'pushState'](null, '', href)
            await loadRoute(href, controller)
        } catch (err) {
            console.error('[router] navigate error:', err)
        } finally {
            if (!controller.signal.aborted) setIsNavigating(() => false)
        }
    }

    let revalidatingController: AbortController | null = null

    const revalidate = async () => {
        revalidatingController?.abort()
        const controller = new AbortController()
        revalidatingController = controller

        const to = window.location.pathname + window.location.search
        let dataRes: Response
        try {
            dataRes = await fetch(`/_devix/data${to}`, {
                signal: controller.signal,
            })
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            throw err
        }

        if (controller.signal.aborted) return
        if (!dataRes.ok) return

        const data = await decodeResponse(dataRes)
        if (controller.signal.aborted) return

        if (data.redirect) {
            await navigate(data.redirect, {replace: data.redirectReplace})
            return
        }
        setState(s => ({
            ...s,
            _navKey: s._navKey + 1,
            loaderData: data.loaderData,
            layoutsData: (data.layouts ?? []).map((l: any) => l.loaderData),
            guardData: data.guardData ?? null,
            params: data.params ?? s.params,
            metadata: data.metadata ?? s.metadata,
            viewport: data.viewport ?? s.viewport,
        }))
    }

    createEffect(() => {
        const meta = state().metadata
        if (meta?.title && document.title !== meta.title) {
            document.title = meta.title
        }
    })

    createEffect(() => {
        const handlePop = () => {
            navigatingController?.abort()
            const controller = new AbortController()
            navigatingController = controller

            const to = window.location.pathname + window.location.search
            loadRoute(to, controller).catch(err => {
                if (err.name !== 'AbortError') console.error('[router] popstate error:', err)
            })
        }
        window.addEventListener("popstate", handlePop)
        onCleanup(() => window.removeEventListener("popstate", handlePop))
    })

    return (
        <PageMetaContext.Provider value={{
            metadata: state().metadata,
            viewport: state().viewport,
            clientEntry,
        }}>
            <RouterContext.Provider value={{
                get pathname() { return state().pathname },
                get search() { return state().search },
                get params() { return state().params },
                get loaderData() { return state().loaderData },
                get layoutsData() { return state().layoutsData },
                get guardData() { return state().guardData },
                get Page() { return state().Page },
                get layouts() { return state().layouts },
                get metadata() { return state().metadata },
                get viewport() { return state().viewport },
                isNavigating: isNavigating(),
                navigate,
                revalidate,
                prefetchRoute,
            }}>
                <ContentTree
                    _navKey={state()._navKey}
                    pathname={state().pathname}
                    params={state().params}
                    loaderData={state().loaderData}
                    layoutsData={state().layoutsData}
                    Page={state().Page}
                    layouts={state().layouts}
                    ErrorPage={state().ErrorPage}
                    pendingError={state().pendingError}
                />
            </RouterContext.Provider>
        </PageMetaContext.Provider>
    )
}
