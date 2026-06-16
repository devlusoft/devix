import { describe, expect, it } from 'vitest'
import { generateManifestModule, generateRoutesModule } from './codegen'
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

describe('generateManifestModule', () => {
  it('should export manifest as JSON', () => {
    const out = generateManifestModule(
      buildResult({ routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })] }),
    )
    expect(out).toContain('export const manifest =')
    expect(out).toContain('/about')
  })
})

describe('generateRoutesModule', () => {
  it('should import Route and Router from @solidjs/router', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain('@solidjs/router')
    expect(out).toMatch(/\bRoute\b/)
    expect(out).toMatch(/\bRouter\b/)
  })

  it('should import createComponent and lazy from solid-js', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain('createComponent')
    expect(out).toContain('lazy')
    expect(out).toContain(`from 'solid-js'`)
  })

  it('should use import.meta.glob without eager for lazy loading', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain(`import.meta.glob('/app/pages/**/*.tsx')`)
    expect(out).not.toContain('{ eager: true }')
  })

  it('should default export a Routes function that accepts url as prop', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain('export default function Routes(props)')
  })

  it('should wrap routes in a Router with url from props.url', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain('createComponent(Router,')
    expect(out).toMatch(/const url = props\.url/)
  })

  it('should fall back to window.location.pathname on the client when props.url is missing', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain(`typeof window !== 'undefined' ? window.location.pathname : '/'`)
  })

  it('should build routeList with one entry per route', () => {
    const result = buildResult({
      routes: [
        fixture({ path: '/about', file: 'about.tsx', isIndex: false }),
        fixture({ path: '/blog', file: 'blog/index.tsx' }),
      ],
    })
    const out = generateRoutesModule(result)
    const aboutMatches = out.match(/path:\s*['"]\/about['"]/g) ?? []
    expect(aboutMatches).toHaveLength(1)
    const blogMatches = out.match(/path:\s*['"]\/blog['"]/g) ?? []
    expect(blogMatches).toHaveLength(1)
  })

  it('should set path from route.path in each entry', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain(`path: "/about"`)
  })

  it('should reference the module by file path via makeRouteComponent', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain(`"/app/pages/about.tsx"`)
    expect(out).toContain('makeRouteComponent')
  })
})

describe('generateRoutesModule — nested layouts', () => {
  it('should NOT emit get children() for routes without children (besides the wrapper Router and makeRouteComponent)', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    const matches = out.match(/get children\(\)/g) ?? []
    expect(matches).toHaveLength(5)
  })

  it('should emit nested Route with get children() for layout + index', () => {
    const result = buildResult({
      routes: [
        fixture({
          path: '/blog',
          file: 'blog/layout.tsx',
          isIndex: false,
          isLayout: true,
          children: [fixture({ path: '/', file: 'blog/index.tsx', isIndex: true })],
        }),
      ],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain('path: "/blog"')
    expect(out).toContain('"/app/pages/blog/layout.tsx"')
    expect(out).toContain('"/app/pages/blog/index.tsx"')
    const matches = out.match(/get children\(\)/g) ?? []
    expect(matches).toHaveLength(6)
  })

  it('should emit all children under one layout', () => {
    const result = buildResult({
      routes: [
        fixture({
          path: '/blog',
          file: 'blog/layout.tsx',
          isLayout: true,
          children: [
            fixture({ path: '/', file: 'blog/index.tsx', isIndex: true }),
            fixture({
              path: '/:slug',
              file: 'blog/[slug].tsx',
              params: ['slug'],
              isIndex: false,
            }),
          ],
        }),
      ],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain('path: "/:slug"')
    expect(out).toContain('"/app/pages/blog/index.tsx"')
    expect(out).toContain('"/app/pages/blog/[slug].tsx"')
    const routeMatches = out.match(/createComponent\(Route,/g) ?? []
    expect(routeMatches).toHaveLength(3)
  })

  it('should emit deeply nested Routes for nested layouts', () => {
    const result = buildResult({
      routes: [
        fixture({
          path: '/blog',
          file: 'blog/layout.tsx',
          isLayout: true,
          children: [
            fixture({
              path: '/posts',
              file: 'blog/posts/layout.tsx',
              isLayout: true,
              children: [fixture({ path: '/', file: 'blog/posts/index.tsx', isIndex: true })],
            }),
          ],
        }),
      ],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain('"/app/pages/blog/layout.tsx"')
    expect(out).toContain('"/app/pages/blog/posts/layout.tsx"')
    expect(out).toContain('"/app/pages/blog/posts/index.tsx"')

    const childMatches = out.match(/get children\(\)/g) ?? []
    expect(childMatches).toHaveLength(7)

    const routeMatches = out.match(/createComponent\(Route,/g) ?? []
    expect(routeMatches).toHaveLength(3)

    expect(out.indexOf('"/app/pages/blog/layout.tsx"')).toBeLessThan(
      out.indexOf('"/app/pages/blog/posts/layout.tsx"'),
    )
    expect(out.indexOf('"/app/pages/blog/posts/layout.tsx"')).toBeLessThan(
      out.indexOf('"/app/pages/blog/posts/index.tsx"'),
    )
  })

  it('should NOT flatten nested paths into a single Route', () => {
    const result = buildResult({
      routes: [
        fixture({
          path: '/blog',
          file: 'blog/layout.tsx',
          isLayout: true,
          children: [
            fixture({
              path: '/posts',
              file: 'blog/posts/layout.tsx',
              isLayout: true,
              children: [fixture({ path: '/', file: 'blog/posts/index.tsx', isIndex: true })],
            }),
          ],
        }),
      ],
    })
    const out = generateRoutesModule(result)
    expect(out).not.toContain('path: "/blog/posts"')
    expect(out).not.toContain('path: "/blog/posts/"')
  })

  it('should integrate with buildManifest end-to-end for layout + index + dynamic', () => {
    const manifestResult = buildManifest({
      files: ['blog/layout.tsx', 'blog/index.tsx', 'blog/[slug].tsx'],
    })
    const out = generateRoutesModule(manifestResult)
    expect(out).toContain('path: "/blog"')
    expect(out).toContain('path: "/"')
    expect(out).toContain('path: "/:slug"')
    expect(out).toContain('"/app/pages/blog/layout.tsx"')
    const routeMatches = out.match(/createComponent\(Route,/g) ?? []
    expect(routeMatches).toHaveLength(3)
  })
})

describe('generateRoutesModule — view transitions wrapper', () => {
  it('should import ClickInterceptor from the framework subpath', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain(
      `import { ClickInterceptor } from '@devlusoft/devix/router/view-transitions/click-interceptor'`,
    )
  })

  it('should define makeRouteComponent that wraps a lazy component in ClickInterceptor', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain('function makeRouteComponent')
    expect(out).toMatch(/createComponent\(ClickInterceptor,/)
    expect(out).toMatch(/lazy\(/)
  })

  it('should use makeRouteComponent for each route', () => {
    const result = buildResult({
      routes: [
        fixture({ path: '/about', file: 'about.tsx', isIndex: false }),
        fixture({ path: '/data', file: 'data.tsx', isIndex: false }),
      ],
    })
    const out = generateRoutesModule(result)
    const routeMatches = out.match(/createComponent\(Route,/g) ?? []
    const componentMatches = out.match(/makeRouteComponent\(modules\[/g) ?? []
    expect(routeMatches).toHaveLength(2)
    expect(componentMatches).toHaveLength(2)
  })

  it('should define makeRouteComponent before Routes and call it inside route definitions', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    const helperIdx = out.indexOf('function makeRouteComponent')
    const routeIdx = out.indexOf('createComponent(Route,')
    expect(helperIdx).toBeGreaterThan(-1)
    expect(routeIdx).toBeGreaterThan(-1)
    expect(helperIdx).toBeLessThan(routeIdx)
  })

  it('should integrate with the real showcase manifest end-to-end', () => {
    const manifestResult = buildManifest({
      files: [
        'index.tsx',
        'data.tsx',
        'blog/layout.tsx',
        'blog/index.tsx',
        'blog/[slug].tsx',
        'transitions/red.tsx',
        'transitions/blue.tsx',
      ],
    })
    const out = generateRoutesModule(manifestResult)
    expect(out).toContain('path: "/transitions/red"')
    expect(out).toContain('path: "/transitions/blue"')
    expect(out).toContain('"/app/pages/transitions/red.tsx"')
    expect(out).toContain('"/app/pages/transitions/blue.tsx"')
    expect(out).toMatch(/createComponent\(ClickInterceptor,/)
    const routeMatches = out.match(/createComponent\(Route,/g) ?? []
    expect(routeMatches.length).toBeGreaterThanOrEqual(7)
    const componentMatches = out.match(/makeRouteComponent\(modules\[/g) ?? []
    expect(componentMatches.length).toBe(routeMatches.length)
  })
})
