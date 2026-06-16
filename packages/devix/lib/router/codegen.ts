import type { BuildManifestResult, RouteNode } from './manifest'

function renderRoute(node: RouteNode): string {
  if (!node.file) {
    throw new Error(`Codegen: RouteNode at path "${node.path}" has no file`)
  }

  const path = JSON.stringify(node.path)
  const loader = `modules[${JSON.stringify(`/app/pages/${node.file}`)}]`
  const isLeaf = node.children.length === 0
  const middlewares = JSON.stringify(node.middlewares)
  const component = `makeRouteComponent(${loader}, ${middlewares}, ${isLeaf})`

  if (isLeaf) {
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

export function generateManifestModule(result: BuildManifestResult): string {
  return `export const manifest = ${JSON.stringify(result)}`
}

export function generateRoutesModule(result: BuildManifestResult): string {
  const routesRendered = result.routes.map(renderRoute).join(',\n')
  const manifestJson = JSON.stringify(result)

  return `import { Route, Router, useLocation, useNavigate } from '@solidjs/router'
    import { createComponent, createEffect, createSignal, lazy, on, Show } from 'solid-js'
    import { runRouteMiddlewares } from '@devlusoft/devix/router/middleware'
    import { ClickInterceptor } from '@devlusoft/devix/router/view-transitions/click-interceptor'

    const modules = import.meta.glob('/app/pages/**/*.tsx')
    const middlewareModules = import.meta.glob(['/app/pages/**/middleware.ts', '/app/pages/**/middleware.tsx'])
    const manifest = ${manifestJson}

    function makeRouteComponent(loader, middlewares, isLeaf) {
      const LazyComponent = lazy(loader)
      if (isLeaf && middlewares.length > 0) {
        return (props) =>
          createComponent(RouteMiddleware, {
            middlewares,
            get children() {
              return createComponent(ClickInterceptor, {
                get children() {
                  return [createComponent(LazyComponent, props)]
                },
              })
            },
          })
      }
      return (props) =>
        createComponent(ClickInterceptor, {
          get children() {
            return [createComponent(LazyComponent, props)]
          },
        })
    }

    function RouteMiddleware(props) {
      const location = useLocation()
      const navigate = useNavigate()
      const [ready, setReady] = createSignal(false)

      const run = async (path) => {
        const redirect = await runRouteMiddlewares({
          url: path,
          manifest,
          request: new Request(typeof window !== 'undefined' ? window.location.origin + path : 'http://localhost' + path),
          loadMiddleware: async (file) => middlewareModules['/app/pages/' + file](),
        })
        if (redirect) {
          const target = redirect instanceof Response ? redirect.headers.get('Location') || '/' : redirect
          navigate(target, { replace: true })
        }
        setReady(true)
      }

      createEffect(on(() => location.pathname, run, { defer: false }))

      return createComponent(Show, {
        get when() { return ready() },
        get children() { return props.children },
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
