import type { Component, JSX } from 'solid-js'
import { createComponent } from 'solid-js'
import { Dynamic, HydrationScript } from 'solid-js/web'

export type DevixRootProps = {
  children?: JSX.Element
  assets?: JSX.Element
  scripts?: JSX.Element
}

export function compose(
  Root: Component<DevixRootProps>,
  Routes: Component<{ url?: string }>,
  url: string,
) {
  return createComponent(Root, {
    get assets() {
      return createComponent(HydrationScript, {})
    },
    get scripts() {
      return createComponent(Dynamic, {
        component: 'script',
        type: 'module',
        src: '/@id/virtual:devix-hydration',
      })
    },
    get children() {
      return createComponent(Routes, { url })
    },
  })
}
