import type {Component, Accessor} from 'solid-js'
import type {NavigateOptions} from './context'
import type {ErrorProps, LayoutProps, PageProps} from '../server/types'
export interface RouterContextSignals {
    pathname: Accessor<string>
    search: Accessor<string>
    params: Accessor<Record<string, string>>
    Page: Accessor<Component<PageProps>>
    layouts: Accessor<Component<LayoutProps>[]>
    isNavigating: Accessor<boolean>
    pendingError: Accessor<ErrorProps | undefined>
    ErrorPage: Accessor<Component<ErrorProps> | undefined>
}

export interface RouterActions {
    navigate: (to: string, options?: NavigateOptions) => Promise<void>
    revalidate: () => Promise<void>
    prefetchRoute: (href: string) => void
}

export function createRouterContext(signals: RouterContextSignals, actions: RouterActions) {
    return {
        get pathname() { return signals.pathname() },
        get search() { return signals.search() },
        get params() { return signals.params() },
        get Page() { return signals.Page() },
        get layouts() { return signals.layouts() },
        get isNavigating() { return signals.isNavigating() },
        get pendingError() { return signals.pendingError() },
        get ErrorPage() { return signals.ErrorPage() },
        navigate: actions.navigate,
        revalidate: actions.revalidate,
        prefetchRoute: actions.prefetchRoute,
    }
}
