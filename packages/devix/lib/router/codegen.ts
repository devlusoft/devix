import type { BuildManifestResult, RouteNode } from './manifest'

function renderRoute(node: RouteNode): string {
  if (!node.file) {
    throw new Error(`Codegen: RouteNode at path "${node.path}" has no file`)
  }

  const path = JSON.stringify(node.path)
  const loader = `modules[${JSON.stringify(`/app/pages/${node.file}`)}]`
  const component = `makeRouteComponent(${loader})`

  if (node.children.length === 0) {
    return `createComponent(Route, { path: ${path}, component: ${component} })`
  }

  const childrenRendered = node.children.map(renderRoute).join(',\n')
  return `createComponent(Route, {
      path: ${path},
      component: ${component},
      get children() {
        return [
    ${childrenRendered}
        ]
      },
    })`
}

function renderRouteEager(node: RouteNode): string {
  if (!node.file) {
    throw new Error(`Codegen: RouteNode at path "${node.path}" has no file`)
  }

  const path = JSON.stringify(node.path)
  const component = `makeRouteComponent(${JSON.stringify(`/app/pages/${node.file}`)})`

  if (node.children.length === 0) {
    return `createComponent(Route, { path: ${path}, component: ${component} })`
  }

  const childrenRendered = node.children.map(renderRouteEager).join(',\n')
  return `createComponent(Route, {
      path: ${path},
      component: ${component},
      get children() {
        return [
    ${childrenRendered}
        ]
      },
    })`
}

export function generateRoutesModule(result: BuildManifestResult): string {
  const routesRendered = result.routes.map(renderRoute).join(',\n')

  return `import { Route, Router } from '@solidjs/router'
    import { createComponent, lazy } from 'solid-js'
    import { ClickInterceptor } from '@devlusoft/devix/router/view-transitions/click-interceptor'

    const modules = import.meta.glob('/app/pages/**/*.tsx')

    function makeRouteComponent(loader) {
      const LazyComponent = lazy(loader)
      return (props) =>
        createComponent(ClickInterceptor, {
          get children() {
            return [createComponent(LazyComponent, props)]
          },
        })
    }

    export default function Routes(props) {
      const url = props.url ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
      return createComponent(Router, {
        url,
        get children() {
          return [
    ${routesRendered}
          ]
        },
      })
    }
    `
}

export function generateSSRRoutesModule(result: BuildManifestResult): string {
  const routesRendered = result.routes.map(renderRouteEager).join(',\n')

  return `import { Route, Router } from '@solidjs/router'
    import { createComponent } from 'solid-js'
    import { ClickInterceptor } from '@devlusoft/devix/router/view-transitions/click-interceptor'

    const modules = import.meta.glob('/app/pages/**/*.tsx', { eager: true })

    function makeRouteComponent(key) {
      const Component = modules[key].default
      return (props) =>
        createComponent(ClickInterceptor, {
          get children() {
            return [createComponent(Component, props)]
          },
        })
    }

    export default function Routes(props) {
      const url = props.url ?? '/'
      return createComponent(Router, {
        url,
        get children() {
          return [
    ${routesRendered}
          ]
        },
      })
    }
    `
}
