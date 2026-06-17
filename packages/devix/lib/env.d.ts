declare module 'virtual:devix-routes' {
  import type { Component } from 'solid-js'

  const Routes: Component
  export default Routes
}

declare module 'virtual:devix-routes-ssr' {
  import type { ManifestRouteNode } from '@devlusoft/devix/router/preload'
  import type { Component } from 'solid-js'

  export const manifest: ManifestRouteNode[]
  const Routes: Component
  export default Routes
}
