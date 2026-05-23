declare module "virtual:devix/client-routes" {
    import type {Component} from "solid-js";

    export interface ClientMatch {
        load: () => Promise<{ default: Component<any> }>
        loadLayouts: Array<() => Promise<{ default: Component<any> }>>
        params: Record<string, string>
    }

    export function matchClientRoute(pathname: string): ClientMatch | null
    export function loadErrorPage(): Promise<Component<any> | null>
    export function getDefaultErrorPage(): Component<any>
}

declare module "virtual:devix/context" {
    export { RouterContext, RouterContextValue } from '@devlusoft/devix/runtime/context'
}