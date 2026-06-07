import type { BuildManifestResult, RouteNode } from './manifest'

function withInterceptor(component: string): string {
  return `(routeProps) => createComponent(ClickInterceptor, {
        get children() {
          return [createComponent(${component}, routeProps)]
        },
      })`
}

function renderRoute(node: RouteNode): string {
  if (!node.file) {
    throw new Error(`Codegen: RouteNode at path "${node.path}" has no file`)
  }

  const path = JSON.stringify(node.path)
  const component = `modules[${JSON.stringify(`/app/pages/${node.file}`)}].default`
  const wrappedComponent = withInterceptor(component)

  if (node.children.length === 0) {
    return `createComponent(Route, { path: ${path}, component: ${wrappedComponent} })`
  }

  const childrenRendered = node.children.map(renderRoute).join(',\n')
  return `createComponent(Route, {
      path: ${path},
      component: ${wrappedComponent},
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
    import { createComponent } from 'solid-js'
    import { ClickInterceptor } from '@devlusoft/devix/router/view-transitions/click-interceptor'

    const modules = import.meta.glob('/app/pages/**/*.tsx', { eager: true })

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
