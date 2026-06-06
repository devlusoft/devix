import type { Component, JSX } from 'solid-js'
import { createComponent } from 'solid-js'

export function compose(
  Root: Component<{ children?: JSX.Element }>,
  Routes: Component<{ url?: string }>,
  url: string,
) {
  return createComponent(Root, {
    get children() {
      return createComponent(Routes, { url })
    },
  })
}
