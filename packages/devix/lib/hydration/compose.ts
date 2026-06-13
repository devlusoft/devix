import type { Component, JSX } from 'solid-js'
import { createComponent } from 'solid-js'
import { Dynamic, HydrationScript } from 'solid-js/web'

export type DevixRootProps = {
  children?: JSX.Element
  assets?: JSX.Element
  scripts?: JSX.Element
}

const DEFAULT_CLIENT_ENTRY = '/@id/virtual:devix-hydration'

export function compose(
  Root: Component<DevixRootProps>,
  Routes: Component<{ url?: string }>,
  url: string,
  clientEntry: string = DEFAULT_CLIENT_ENTRY,
) {
  return createComponent(Root, {
    get assets() {
      return createComponent(HydrationScript, {})
    },
    get scripts() {
      return createComponent(Dynamic, {
        component: 'script',
        type: 'module',
        src: clientEntry,
      })
    },
    get children() {
      return createComponent(Routes, { url })
    },
  })
}
