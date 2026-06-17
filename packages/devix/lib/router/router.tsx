import { createComponent, createSignal, onCleanup, onMount, type ParentProps } from 'solid-js'
import {
  type LocationAccessor,
  LocationContext,
  type LocationState,
  MatchContext,
  NavigateContext,
  type NavigateFn,
  type ParamsAccessor,
} from './context'
import { findRouteForUrl, type RouteNode } from './manifest'

function readBrowserLocation(): LocationState {
  const path = window.location.pathname + window.location.search + window.location.hash
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    query: parseSearch(window.location.search),
    path,
  }
}

function readServerLocation(url: string): LocationState {
  const u = new URL(url, 'http://localhost')
  return {
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    query: parseSearch(u.search),
    path: u.pathname + u.search + u.hash,
  }
}

function parseSearch(search: string): Record<string, string> {
  const out: Record<string, string> = {}
  const qs = search.startsWith('?') ? search.slice(1) : search
  if (!qs) return out
  for (const pair of qs.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const key = eq === -1 ? pair : pair.slice(0, eq)
    const value = eq === -1 ? '' : pair.slice(eq + 1)
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

export type RouterProps = ParentProps<{
  url?: string
  root?: import('solid-js').Component<{ children: import('solid-js').JSX.Element }>
  manifest?: { routes: RouteNode[] }
}>

export function Router(props: RouterProps) {
  const isServer = typeof window === 'undefined'

  const [location, setLocation] = createSignal<LocationState>(
    isServer ? readServerLocation(props.url ?? '/') : readBrowserLocation(),
    { equals: false },
  )

  const [params, setParams] = createSignal<Record<string, string>>({})

  const navigate: NavigateFn = (to, options = {}) => {
    if (typeof window === 'undefined') return
    const next = new URL(to, window.location.origin)
    const target = next.pathname + next.search + next.hash
    if (options.replace) {
      window.history.replaceState(options.state ?? null, '', target)
    } else {
      window.history.pushState(options.state ?? null, '', target)
    }
    setLocation(readBrowserLocation())
    if (options.scroll !== false) {
      window.scrollTo(0, 0)
    }
  }

  if (!isServer) {
    onMount(() => {
      const onPop = () => setLocation(readBrowserLocation())
      window.addEventListener('popstate', onPop)
      onCleanup(() => window.removeEventListener('popstate', onPop))
    })
  }

  const matchNodes = (): ParamsAccessor => {
    const manifest = props.manifest
    if (!manifest) return () => ({})
    return () => {
      const match = findRouteForUrl(manifest.routes, location().pathname)
      if (!match) return {}
      const out: Record<string, string> = {}
      for (const layout of match.layouts) {
        Object.assign(
          out,
          layout.params.reduce<Record<string, string>>((acc, k) => ((acc[k] = ''), acc), {}),
        )
      }
      Object.assign(out, match.params)
      const next: Record<string, string> = {}
      for (const k of Object.keys(out)) {
        const v = out[k]
        if (v) next[k] = v
      }
      return next
    }
  }

  const paramsAccessor: ParamsAccessor = () => {
    const accessor = matchNodes()
    const next = accessor()
    const prev = params()
    const sameKeys = Object.keys(next).length === Object.keys(prev).length
    if (sameKeys) {
      let allEqual = true
      for (const k of Object.keys(next)) {
        if (next[k] !== prev[k]) {
          allEqual = false
          break
        }
      }
      if (allEqual) return prev
    }
    setParams(next)
    return next
  }

  const locationAccessor: LocationAccessor = () => location()

  return createComponent(LocationContext.Provider, {
    value: locationAccessor,
    get children() {
      return createComponent(NavigateContext.Provider, {
        value: navigate,
        get children() {
          return createComponent(MatchContext.Provider, {
            value: paramsAccessor,
            get children() {
              const children = props.children
              return props.root
                ? createComponent(props.root, {
                    get children() {
                      return children
                    },
                  })
                : children
            },
          })
        },
      })
    },
  })
}
