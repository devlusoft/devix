import { MetaProvider } from '@solidjs/meta'
import type { Component, JSX } from 'solid-js'
import { createComponent } from 'solid-js'
import { Dynamic, HydrationScript } from 'solid-js/web'

export type DevixRootProps = {
  children?: JSX.Element
  assets?: JSX.Element
  scripts?: JSX.Element
}

const DEFAULT_CLIENT_ENTRY = '/@id/virtual:devix-hydration'

type ComposeOptions = {
  clientEntry?: string
  styles?: JSX.Element[]
}

export function compose(
  Root: Component<DevixRootProps>,
  Routes: Component<{ url?: string }>,
  url: string,
  options: string | ComposeOptions = {},
) {
  const opts = typeof options === 'string' ? { clientEntry: options } : options
  const clientEntry = opts.clientEntry ?? DEFAULT_CLIENT_ENTRY
  const styles = opts.styles

  return createComponent(MetaProvider, {
    get children() {
      return createComponent(Root, {
        get assets() {
          return [styles, createComponent(HydrationScript, {})]
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
    },
  })
}
