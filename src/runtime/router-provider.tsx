import {ComponentType, ReactNode, useCallback, useContext, useEffect, useRef, useState} from "react";
import {RouterContext} from 'virtual:devix/context'
import {ErrorProps, LayoutProps, PageProps} from "../server/types";
import {Metadata, Viewport} from "../types";
import {getDefaultErrorPage, loadErrorPage, matchClientRoute} from "virtual:devix/client-routes";
import {buildHeadNodes} from "./head";
import {PageMetaContext, RouteDataContext} from "./context";
import {DevixErrorBoundary} from "./error-boundary";

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

export function useNavigate() {
    const ctx = useContext(RouterContext)
    if (!ctx) throw new Error("useNavigate must be used within a RouterProvider")
    return ctx.navigate
}

export function useParams<T extends Record<string, string>>() {
    const ctx = useContext(RouteDataContext)
    if (!ctx) throw new Error("useParams must be used within a route or layout")
    return ctx.params as T
}

type LoaderReturnType<T> = T extends (...args: any[]) => Promise<infer R>
    ? R
    : T extends (...args: any[]) => infer R
        ? R
        : T

export function useLoaderData<T>() {
    const ctx = useContext(RouteDataContext)
    if (!ctx) throw new Error("useLoaderData must be used within a route or layout")
    return ctx.loaderData as LoaderReturnType<T>
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

    const loadRoute = useCallback(async (to: string, controller: AbortController) => {
        const pathname = to.split('?')[0]
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

        const [pageMod, ...layoutMods] = await Promise.all([
            matched.load(),
            ...matched.loadLayouts.map(l => l()),
        ])

        if (controller.signal.aborted) return
        if (!pageMod.default) return

        const dataRes = await fetch(`/_data${to}`, {
            headers: {Accept: 'application/json'},
            signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (!dataRes.ok) {
            if (dataRes.status === 404) {
                window.location.href = to
                return
            }
            console.error(`/_data${to} returned ${dataRes.status}`)
            return
        }

        const data = await dataRes.json()

        window.scrollTo(0, 0)
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
    }, [])

    const navigate = useCallback(async (to: string) => {
        navigatingRef.current?.abort()
        const controller = new AbortController()
        navigatingRef.current = controller

        setIsNavigating(true)
        try {
            window.history.pushState(null, "", to)
            await loadRoute(to, controller)
        } finally {
            if (!controller.signal.aborted) setIsNavigating(false)
        }
    }, [loadRoute])

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
                <state.Page data={state.loaderData} params={state.params} url={state.pathname}/>
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
            {state.metadata && buildHeadNodes(state.metadata, state.viewport)}
            <RouterContext value={{...state, isNavigating, navigate}}>
                {content}
            </RouterContext>
        </PageMetaContext>
    )
}