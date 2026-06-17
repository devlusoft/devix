import { describe, expect, it, vi } from 'vitest'
import { buildManifest } from './manifest'
import {
  clearRouteModuleCache,
  collectLoadersForUrl,
  type ManifestRouteNode,
  normalizeUrlPath,
  preloadRoutesForUrl,
} from './preload'

function buildManifestWithLoaders(files: string[]): ManifestRouteNode[] {
  const { routes } = buildManifest({ files })
  function attach(node: (typeof routes)[number]): ManifestRouteNode {
    return {
      ...node,
      loader: vi.fn(async () => ({ default: () => null })),
      children: node.children.map(attach),
    }
  }
  return routes.map(attach)
}

describe('normalizeUrlPath', () => {
  it('extracts pathname from absolute URLs', () => {
    expect(normalizeUrlPath('https://example.com/foo/bar?x=1')).toBe('/foo/bar')
  })

  it('strips query and hash from path-only URLs', () => {
    expect(normalizeUrlPath('/login?next=/')).toBe('/login')
  })
})

describe('collectLoadersForUrl', () => {
  const manifest = buildManifestWithLoaders(['layout.tsx', 'index.tsx', 'login.tsx', 'other.tsx'])

  it('collects layout + page loaders for nested routes', () => {
    const loaders = collectLoadersForUrl(manifest, '/login')
    expect(loaders).toHaveLength(2)
  })

  it('returns null for unknown routes', () => {
    expect(collectLoadersForUrl(manifest, '/unknown')).toBeNull()
  })
})

describe('preloadRoutesForUrl', () => {
  it('caches loader invocations per URL', async () => {
    clearRouteModuleCache()
    const manifest = buildManifestWithLoaders(['layout.tsx', 'index.tsx', 'login.tsx'])

    await preloadRoutesForUrl('/login', manifest)
    await preloadRoutesForUrl('/login', manifest)

    const loaders = collectLoadersForUrl(manifest, '/login')!
    for (const loader of loaders) {
      expect(loader).toHaveBeenCalledTimes(1)
    }
  })
})
