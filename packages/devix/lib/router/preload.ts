import { matchNodePath, type RouteNode } from './manifest'

export type ManifestRouteNode = RouteNode & {
  loader: () => Promise<unknown>
  children: ManifestRouteNode[]
}

export function normalizeUrlPath(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname
    } catch {
      // fall through
    }
  }
  const path = url.split('?')[0].split('#')[0]
  return path || '/'
}

export function collectLoadersForUrl(
  nodes: ManifestRouteNode[],
  urlPath: string,
): Array<() => Promise<unknown>> | null {
  const parts = urlPath.split('/').filter(Boolean)

  function match(
    nodesToMatch: ManifestRouteNode[],
    remainingParts: string[],
    loaders: Array<() => Promise<unknown>>,
  ): Array<() => Promise<unknown>> | null {
    for (const node of nodesToMatch) {
      const nodeMatch = matchNodePath(node.path, remainingParts)
      if (!nodeMatch) continue

      if (node.isLayout) {
        if (node.file) loaders.push(node.loader)
        const childResult = match(node.children, remainingParts.slice(nodeMatch.consumed), loaders)
        if (childResult) return childResult
      } else if (remainingParts.length === nodeMatch.consumed) {
        if (node.file) loaders.push(node.loader)
        return loaders
      }
    }
    return null
  }

  return match(nodes, parts, [])
}

const routeModuleCache = new Map<string, Promise<unknown[]>>()

export async function preloadRoutesForUrl(
  url: string,
  manifest: ManifestRouteNode[],
): Promise<void> {
  const pathname = normalizeUrlPath(url)
  let cached = routeModuleCache.get(pathname)
  if (!cached) {
    const loaders = collectLoadersForUrl(manifest, pathname)
    if (!loaders) return
    cached = Promise.all(loaders.map((loader) => loader()))
    routeModuleCache.set(pathname, cached)
  }
  await cached
}

export function clearRouteModuleCache(): void {
  routeModuleCache.clear()
}
