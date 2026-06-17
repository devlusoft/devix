import { describe, expect, it } from 'vitest'
import { generateSSRRoutesModule } from './codegen'
import { type BuildManifestResult, buildManifest, type RouteNode } from './manifest'

const fixture = (overrides: Partial<RouteNode>): RouteNode => ({
  path: '/',
  file: 'index.tsx',
  isIndex: true,
  isLayout: false,
  middlewares: [],
  params: [],
  children: [],
  ...overrides,
})

const buildResult = (overrides: Partial<BuildManifestResult>): BuildManifestResult => ({
  routes: [],
  ...overrides,
})

describe('generateSSRRoutesModule', () => {
  it('should NOT use import.meta.glob eager', () => {
    const out = generateSSRRoutesModule(buildResult({}))
    expect(out).not.toContain('import.meta.glob')
    expect(out).not.toContain('{ eager: true }')
  })

  it('should export manifest with per-route loaders', () => {
    const out = generateSSRRoutesModule(
      buildResult({ routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })] }),
    )
    expect(out).toContain('export const manifest =')
    expect(out).toContain(`loader: pageLoader("about.tsx")`)
  })

  it('should use lazy() for SSR route components', () => {
    const out = generateSSRRoutesModule(buildResult({}))
    expect(out).toContain('lazy')
    expect(out).toContain('function makeRouteComponent(loader)')
  })

  it('should generate dynamic import per route in Route tree', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateSSRRoutesModule(result)
    expect(out).toContain('pageLoader("about.tsx")')
    expect(out).toContain('makeRouteComponent')
  })

  it('should emit nested manifest children for layouts', () => {
    const result = buildResult({
      routes: [
        fixture({
          path: '/blog',
          file: 'blog/layout.tsx',
          isLayout: true,
          children: [fixture({ path: '/', file: 'blog/index.tsx', isIndex: true })],
        }),
      ],
    })
    const out = generateSSRRoutesModule(result)
    expect(out).toContain('isLayout: true')
    expect(out).toContain('pageLoader("blog/layout.tsx")')
    expect(out).toContain('pageLoader("blog/index.tsx")')
    expect(out).toContain('children: [')
  })
})
