declare module "virtual:devix/client-routes" {
    import type {ComponentType} from "react";

    export interface ClientMatch {
        load: () => Promise<{ default: ComponentType<any> }>
        loadLayouts: Array<() => Promise<{ default: ComponentType<any> }>>
        params: Record<string, string>
    }

    export function matchClientRoute(pathname: string): ClientMatch | null
    export function loadErrorPage(): Promise<ComponentType<any> | null>
    export function getDefaultErrorPage(): ComponentType<any>
}

declare module "virtual:devix/context" {
    export { RouterContext, RouterContextValue } from '@devlusoft/devix/runtime/context'
}