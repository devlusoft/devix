import {Suspense, createMemo, type JSX} from "solid-js";
import type {Component} from "solid-js";
import {RouteDataContext} from "./context";
import {DevixErrorBoundary} from "./error-boundary";
import type {ErrorProps, LayoutProps, PageProps} from "../server/types";

export interface ContentTreeProps {
    pathname: string
    params: Record<string, string>
    loaderData: unknown
    layoutsData: unknown[]
    Page: Component<PageProps>
    layouts: Component<LayoutProps>[]
    ErrorPage?: Component<ErrorProps>
    pendingError?: ErrorProps
    _navKey?: number
}

function LayoutProvider(props: {
    pathname: string
    params: Record<string, string>
    loaderData: unknown
    layouts: Component<LayoutProps>[]
    layoutsData: unknown[]
    Page: Component<PageProps>
}) {
    return createMemo(() => {
        let result: JSX.Element = (
            <RouteDataContext.Provider value={{loaderData: props.loaderData, params: props.params}}>
                <Suspense fallback={null}>
                    <props.Page data={props.loaderData} params={props.params} url={props.pathname}/>
                </Suspense>
            </RouteDataContext.Provider>
        )

        for (let i = props.layouts.length - 1; i >= 0; i--) {
            const Layout = props.layouts[i]
            const layoutData = props.layoutsData[i]
            result = (
                <RouteDataContext.Provider value={{loaderData: layoutData, params: props.params}}>
                    <Layout data={layoutData} params={props.params}>{result}</Layout>
                </RouteDataContext.Provider>
            )
        }

        return result
    }) as unknown as JSX.Element
}

export function ContentTree(props: ContentTreeProps) {
    return createMemo(() => {
        void props._navKey

        if (props.pendingError) {
            return props.ErrorPage
                ? <props.ErrorPage
                    statusCode={props.pendingError.statusCode}
                    message={props.pendingError.message}
                    code={props.pendingError.code}
                    data={props.pendingError.data}
                    headers={props.pendingError.headers}
                />
                : <h1>{props.pendingError.statusCode}</h1>
        }

        return (
            <DevixErrorBoundary ErrorPage={props.ErrorPage}>
                <LayoutProvider
                    pathname={props.pathname}
                    params={props.params}
                    loaderData={props.loaderData}
                    layouts={props.layouts}
                    layoutsData={props.layoutsData}
                    Page={props.Page}
                />
            </DevixErrorBoundary>
        )
    }) as unknown as JSX.Element
}
