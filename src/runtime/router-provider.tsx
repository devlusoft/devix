import {batch, createComponent, createEffect, createMemo, createSignal, on, onCleanup, Show, useContext, type Accessor, type Component, type JSX} from "solid-js";
import type {ErrorProps, LayoutProps, PageProps} from "../server/types";
import type {NavigateOptions} from "./context"
import {RouterContext, type RouterContextValue} from "./context";
import {DevixErrorBoundary} from "./error-boundary";
import {createRouterContext, type RouterContextSignals, type RouterActions} from "./router-context";
import {resolveTo} from "./url";
import {decodeResponse} from "../utils/turbo-serializer";
import {getFrame} from "./request-context";

export interface ClientRouteMatcher {
    matchClientRoute: (pathname: string) => {
        load: () => Promise<any>
        loadLayouts: (() => Promise<any>)[]
        params: Record<string, string>
    } | null
    loadErrorPage: () => Promise<Component<ErrorProps> | null>
    getDefaultErrorPage: () => Component<ErrorProps> | null
}

export function useRouter() {
    return useContext(RouterContext)
}

export function usePathname() {
    const ctx = useContext(RouterContext)
    if (ctx) return () => ctx.pathname
    const frame = getFrame()
    if (frame) {
        const {pathname} = new URL(frame.request.url)
        return () => pathname
    }
    return () => '/'
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
    const ctx = useContext(RouterContext)
    if (!ctx) throw new Error("useParams must be used within a router")
    return () => ctx.params as T
}



export function useSearchParams(): [() => URLSearchParams, (params: Record<string, string | undefined>) => void] {
    const ctx = useContext(RouterContext)
    const search = ctx?.search ?? ''
    const searchParams = createMemo(() => new URLSearchParams(search))
    const setSearchParams = (params: Record<string, string | undefined>) => {
        const next = new URLSearchParams(search)
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined) next.delete(key)
            else next.set(key, value)
        }
        const qs = next.toString()
        ctx?.navigate(qs ? `?${qs}` : ctx.pathname, {replace: true})
    }
    return [searchParams, setSearchParams]
}


interface PrefetchEntry {
    promise: Promise<{ pageMod: any; layoutMods: any[]; data: any } | null>
    controller: AbortController
}

export interface RouterProviderProps {
    pathname?: string
    search?: string
    initialParams: Record<string, string>
    initialPage: Component<PageProps>
    initialLayouts?: Component<LayoutProps>[]
    initialGuardData?: unknown
    initialError?: ErrorProps
    initialErrorPage?: Component<ErrorProps>
    matchClientRoute?: (pathname: string) => {
        load: () => Promise<any>
        loadLayouts: (() => Promise<any>)[]
        params: Record<string, string>
    } | null
    loadErrorPage?: () => Promise<Component<ErrorProps> | null>
    getDefaultErrorPage?: () => Component<ErrorProps> | null
}

export function RouterProvider(props: RouterProviderProps) {
    const isSsr = props.pathname !== undefined

    const [pathname, setPathname] = createSignal(isSsr ? props.pathname! : window.location.pathname)
    const [search, setSearch] = createSignal(isSsr ? (props.search ?? '') : window.location.search)
    const [params, setParams] = createSignal(props.initialParams)
    const [Page, setPage] = createSignal<Component<PageProps>>(props.initialPage)
    const [layouts, setLayouts] = createSignal<Component<LayoutProps>[]>(props.initialLayouts ?? [])
    const [pendingError, setPendingError] = createSignal<ErrorProps | undefined>(props.initialError)
    const [ErrorPage, setErrorPage] = createSignal<Component<ErrorProps> | undefined>(props.initialErrorPage)
    const [isNavigating, setIsNavigating] = createSignal(false)
    let [_guardData, setGuardData] = createSignal(props.initialGuardData ?? null)

    let navigatingController: AbortController | null = null
    let revalidatingController: AbortController | null = null
    let prefetchCache: Map<string, PrefetchEntry> | undefined

    let prefetchRoute = (_href: string) => {}
    let loadRoute: (to: string, controller: AbortController) => Promise<void> = async () => {}
    let navigate: (to: string, options?: NavigateOptions) => Promise<void> = async () => {}
    let revalidate: () => Promise<void> = async () => {}

    if (!isSsr) {
        prefetchCache = new Map()

        prefetchRoute = (href: string) => {
            const resolved = resolveTo(href)
            if (resolved.kind === 'external') return

            const key = resolved.href
            if (prefetchCache!.has(key)) return
            const matched = props.matchClientRoute!(resolved.pathname)
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
                prefetchCache!.delete(key)
            }, 3000)
            promise.finally(() => clearTimeout(expireTimer))

            prefetchCache!.set(key, {promise, controller})
        }

        loadRoute = async (to: string, controller: AbortController) => {
            const newPathname = to.split('?')[0].split('#')[0]
            const qsIndex = to.indexOf('?')
            const newSearch = qsIndex !== -1 ? '?' + to.slice(qsIndex + 1).split('#')[0] : ''
            const matched = props.matchClientRoute!(newPathname)
            if (!matched) {
                const fallbackEP = await props.loadErrorPage!() ?? props.getDefaultErrorPage!()
                batch(() => {

                    setPathname(newPathname)
                    setSearch(newSearch)
                    setPendingError({statusCode: 404, message: 'Not found'})
                    setErrorPage(() => fallbackEP ?? undefined)
                })
                return
            }

            const cached = prefetchCache!.get(to)
            if (cached) prefetchCache!.delete(to)
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

                if (data.metadata?.title) document.title = data.metadata.title
                batch(() => {

                    setPathname(newPathname)
                    setSearch(newSearch)
                    setParams(data.params ?? {})
                    setGuardData(data.guardData ?? null)
                    setPage(() => pageMod.default)
                    setLayouts(layoutMods.map(m => m.default))
                })
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

                    const fallbackEP = await props.loadErrorPage!() ?? props.getDefaultErrorPage!()
                    batch(() => {
    
                        setPathname(newPathname)
                        setSearch(newSearch)
                        setPendingError({
                            statusCode: errorBody?.statusCode ?? dataRes.status,
                            message: errorBody?.message ?? 'Server error',
                            code: errorBody?.code,
                            data: errorBody?.data,
                            headers,
                        })
                        setErrorPage(() => fallbackEP ?? undefined)
                    })
                    return
                }

                let data: any
                try {
                    data = await decodeResponse(dataRes)
                } catch {
                    const fallbackEP = await props.loadErrorPage!() ?? props.getDefaultErrorPage!()
                    batch(() => {
    
                        setPathname(newPathname)
                        setSearch(newSearch)
                        setPendingError({statusCode: 500, message: 'Failed to decode server response'})
                        setErrorPage(() => fallbackEP ?? undefined)
                    })
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

                let pageComp: any
                try {
                    pageComp = (await pagePromise).default
                    if (!pageComp) throw new Error('Page module has no default export')
                } catch (err) {
                    const fallbackEP = await props.loadErrorPage!() ?? props.getDefaultErrorPage!()
                    console.error('[router] page load error:', err)
                    batch(() => {
    
                        setPathname(newPathname)
                        setSearch(newSearch)
                        setPendingError({statusCode: 500, message: 'Failed to load page module'})
                        setErrorPage(() => fallbackEP ?? undefined)
                    })
                    return
                }

                if (data.metadata?.title) document.title = data.metadata.title
                batch(() => {

                    setPathname(newPathname)
                    setSearch(newSearch)
                    setParams(data.params ?? {})
                    setGuardData(data.guardData ?? null)
                    setPage(() => pageComp)
                    setLayouts(layoutMods.map(m => m.default))
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
        }

        navigate = async (to: string, options?: NavigateOptions) => {
            const resolved = resolveTo(to)
            if (resolved.kind === 'external') {
                window.location.href = resolved.url.href
                return
            }
            const href = resolved.href

            navigatingController?.abort()
            const controller = new AbortController()
            navigatingController = controller

            const navigateInternal = async () => {
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

            if (options?.viewTransition && typeof document !== 'undefined' && 'startViewTransition' in document) {
                await document.startViewTransition(navigateInternal).finished
            } else {
                await navigateInternal()
            }
        }

        revalidate = async () => {
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
            if (data.metadata?.title) document.title = data.metadata.title
            batch(() => {
                setGuardData(data.guardData ?? null)
                setParams(data.params ?? params())
            })
        }

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
    }

    const signals: RouterContextSignals = {
        pathname, search, params,
        Page, layouts,
        isNavigating, pendingError, ErrorPage,
    }

    const actions: RouterActions = { navigate, revalidate, prefetchRoute }

    const routerState = createRouterContext(signals, actions)

    const [navKey, setNavKey] = createSignal(1)
    createEffect(on(Page, () => setNavKey(k => k + 1)))

    return (
        <RouterContext.Provider value={routerState}>
            <Show when={pendingError()} keyed fallback={
                <DevixErrorBoundary ErrorPage={ErrorPage()}>
                    <Show when={navKey()} keyed>
                        {_ => <Outlet
                            page={Page()}
                            layouts={layouts()}
                            params={params()}
                            guardData={_guardData}
                            pathname={pathname()}
                        />}
                    </Show>
                </DevixErrorBoundary>
            }>
                {e => (
                    <Show when={ErrorPage()} keyed fallback={<h1>{e.statusCode}</h1>}>
                        {EP => <EP statusCode={e.statusCode} message={e.message} code={e.code} data={e.data} headers={e.headers} />}
                    </Show>
                )}
            </Show>
        </RouterContext.Provider>
    )
}

function Outlet(props: {
    page: Component<PageProps>
    layouts: Component<LayoutProps>[]
    params: Record<string, string>
    guardData: Accessor<unknown>
    pathname: string
}) {
  const comp = buildOutlet(props)
  return comp()
}

function buildOutlet(props: {
  page: Component<PageProps>
  layouts: Component<LayoutProps>[]
  params: Record<string, string>
  guardData: Accessor<unknown>
  pathname: string
}): () => JSX.Element {
  let outlet: () => JSX.Element = () => createComponent(props.page, {
    get params() { return props.params },
    get guardData() { return <T,>() => (props.guardData() ?? {}) as T },
    url: props.pathname,
  })

  for (let i = props.layouts.length - 1; i >= 0; i--) {
    const L = props.layouts[i]
    const childOutlet = outlet
    outlet = () => createComponent(L, {
      get children() { return childOutlet() },
      get params() { return props.params },
      get guardData() { return <T,>() => (props.guardData() ?? {}) as T },
    })
  }

  return outlet
}
