import type {Component, Accessor} from 'solid-js'
import type {NavigateOptions} from './context'
import type {ErrorProps, LayoutProps, PageProps} from '../server/types'
import type {Metadata, Viewport} from '../types'

export interface RouterContextSignals {
    pathname: Accessor<string>
    search: Accessor<string>
    params: Accessor<Record<string, string>>
    guardData: Accessor<unknown>
    Page: Accessor<Component<PageProps>>
    layouts: Accessor<Component<LayoutProps>[]>
    metadata: Accessor<Metadata | null>
    viewport: Accessor<Viewport | undefined>
    isNavigating: Accessor<boolean>
    pendingError: Accessor<ErrorProps | undefined>
    ErrorPage: Accessor<Component<ErrorProps> | undefined>
    _navKey: Accessor<number>
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
        get metadata() { return signals.metadata() },
        get viewport() { return signals.viewport() },
        get isNavigating() { return signals.isNavigating() },
        get guardData() { return signals.guardData() },
        get pendingError() { return signals.pendingError() },
        get ErrorPage() { return signals.ErrorPage() },
        get _navKey() { return signals._navKey() },
        navigate: actions.navigate,
        revalidate: actions.revalidate,
        prefetchRoute: actions.prefetchRoute,
    }
}
