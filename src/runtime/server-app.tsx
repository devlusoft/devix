import {ComponentType, ReactNode} from 'react'
import {RouterContext, PageMetaContext, RouteDataContext, NavigateOptions} from './context'
import {HeadSlot} from './head'
import {DevixErrorBoundary} from './error-boundary'
import {LayoutProps, PageProps} from '../server/types'
import {Metadata, Viewport} from '../types'

const noopNavigate = (_to: string, _opts?: NavigateOptions) => Promise.resolve()
const noopRevalidate = () => Promise.resolve()
const noopPrefetch = (_href: string) => {}

export interface ServerAppProps {
    pathname: string
    params: Record<string, string>
    loaderData: unknown
    layoutsData: unknown[]
    Page: ComponentType<PageProps>
    layouts: ComponentType<LayoutProps>[]
    metadata: Metadata | null
    viewport?: Viewport
    clientEntry: string
}

export function ServerApp({
    pathname, params, loaderData, layoutsData,
    Page, layouts, metadata, viewport, clientEntry,
}: ServerAppProps) {
    let tree: ReactNode = (
        <RouteDataContext value={{loaderData, params}}>
            <Page data={loaderData as any} params={params} url={pathname}/>
        </RouteDataContext>
    )

    for (let i = layouts.length - 1; i >= 0; i--) {
        const Layout = layouts[i]
        const layoutData = layoutsData[i]
        tree = (
            <RouteDataContext value={{loaderData: layoutData, params}}>
                <Layout data={layoutData as any} params={params}>{tree}</Layout>
            </RouteDataContext>
        )
    }

    return (
        <PageMetaContext value={{metadata, viewport, clientEntry}}>
            <HeadSlot metadata={metadata} viewport={viewport}/>
            <RouterContext value={{
                pathname,
                params,
                loaderData,
                layoutsData,
                Page,
                layouts,
                metadata,
                viewport,
                isNavigating: false,
                navigate: noopNavigate,
                revalidate: noopRevalidate,
                prefetchRoute: noopPrefetch,
            }}>
                <DevixErrorBoundary key={pathname}>
                    {tree}
                </DevixErrorBoundary>
            </RouterContext>
        </PageMetaContext>
    )
}
