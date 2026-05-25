import {createContext, Component, type Context} from "solid-js";
import type {LayoutProps, PageProps} from "../server/types";

export interface NavigateOptions {
    replace?: boolean
    viewTransition?: boolean
}

export interface RouterContextValue {
    pathname: string
    search: string
    params: Record<string, string>
    Page: Component<PageProps>
    layouts: Component<LayoutProps>[]
    navigate: (to: string, options?: NavigateOptions) => Promise<void>
    revalidate: () => Promise<void>
    prefetchRoute: (href: string) => void
    isNavigating: boolean
}

const g = globalThis as any

g.__devix_RouterContext__ ??= createContext<RouterContextValue | null>(null)
export const RouterContext: Context<RouterContextValue | null> = g.__devix_RouterContext__

