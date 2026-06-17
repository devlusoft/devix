import { MetaProvider } from '@solidjs/meta'
import type { Component, JSX } from 'solid-js'
import { createComponent } from 'solid-js'
import { HydrationScript } from 'solid-js/web'
import { escapeHtml } from '../server/styles'

export type DevixRootProps = {
  children?: JSX.Element
  assets?: JSX.Element
  scripts?: JSX.Element
}

const DEFAULT_CLIENT_ENTRY = '/@id/virtual:devix-hydration'

type ComposeOptions = {
  clientEntry?: string
  styles?: string[]
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
          return `<script type="module" src="${escapeHtml(clientEntry)}"></script>`
        },
        get children() {
          return createComponent(Routes, { url })
        },
      })
    },
  })
}
