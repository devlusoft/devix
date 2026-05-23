import {Component} from "solid-js";
import {RouterContext, PageMetaContext, NavigateOptions} from './context'
import {ContentTree} from './content-tree'
import {LayoutProps, PageProps} from '../server/types'
import {Metadata, Viewport} from '../types'

const noopNavigate = (_to: string, _opts?: NavigateOptions) => Promise.resolve()
const noopRevalidate = () => Promise.resolve()
const noopPrefetch = (_href: string) => {}

export interface ServerAppProps {
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
    clientEntry: string
}

export function ServerApp({
    pathname, search, params, loaderData, layoutsData, guardData,
    Page, layouts, metadata, viewport, clientEntry,
}: ServerAppProps) {
    return (
        <PageMetaContext.Provider value={{metadata, viewport, clientEntry}}>
            <RouterContext.Provider value={{
                pathname,
                search,
                params,
                loaderData,
                layoutsData,
                guardData,
                Page,
                layouts,
                metadata,
                viewport,
                isNavigating: false,
                navigate: noopNavigate,
                revalidate: noopRevalidate,
                prefetchRoute: noopPrefetch,
            }}>
                <ContentTree
                    pathname={pathname}
                    params={params}
                    loaderData={loaderData}
                    layoutsData={layoutsData}
                    Page={Page}
                    layouts={layouts}
                />
            </RouterContext.Provider>
        </PageMetaContext.Provider>
    )
}

