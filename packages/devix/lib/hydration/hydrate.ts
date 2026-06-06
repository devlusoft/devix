import type { Component, JSX } from 'solid-js'
import { hydrate } from 'solid-js/web'
import { compose } from './compose'

export function hydrateApp(
  Root: Component<{ children?: JSX.Element }>,
  Routes: Component<{ url?: string }>,
) {
  const url = typeof window !== 'undefined' ? window.location.pathname : '/'
  return hydrate(() => compose(Root, Routes, url), document)
}
