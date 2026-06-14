import type { Component, JSX } from 'solid-js'
import { hydrate } from 'solid-js/web'
import { compose } from './compose'

const DEFAULT_CLIENT_ENTRY = '/@id/virtual:devix-hydration'

export function hydrateApp(
  Root: Component<{ children?: JSX.Element }>,
  Routes: Component<{ url?: string }>,
  clientEntry: string = DEFAULT_CLIENT_ENTRY,
) {
  const url = typeof window !== 'undefined' ? window.location.pathname : '/'
  return hydrate(() => compose(Root, Routes, url, clientEntry), document)
}
