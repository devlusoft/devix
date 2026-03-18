import {createContext, Context, ComponentType} from "react";
import {Metadata, Viewport} from "../types";
import {LayoutProps, PageProps} from "../server/types";

export interface RouterContextValue {
    pathname: string
    params: Record<string, string>
    loaderData: unknown
    layoutsData: unknown[]
    Page: ComponentType<PageProps>
    layouts: ComponentType<LayoutProps>[]
    metadata: Metadata | null
    viewport?: Viewport
    navigate: (to: string) => void
    isNavigating: boolean
}

export interface PageMetaContextValue {
    metadata: Metadata | null
    viewport?: Viewport
    clientEntry?: string
}

export interface RouteDataContextValue {
    loaderData: unknown
    params: Record<string, string>
}

const g = globalThis as any

g.__devix_RouterContext__ ??= createContext<RouterContextValue | null>(null)
export const RouterContext: Context<RouterContextValue | null> = g.__devix_RouterContext__

g.__devix_PageMetaContext__ ??= createContext<PageMetaContextValue | null>(null)
g.__devix_RouteDataContext__ ??= createContext<RouteDataContextValue | null>(null)

export const PageMetaContext: Context<PageMetaContextValue | null> = g.__devix_PageMetaContext__
export const RouteDataContext: Context<RouteDataContextValue | null> = g.__devix_RouteDataContext__

