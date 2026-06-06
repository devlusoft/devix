import { describe, expect, it } from 'vitest'
import { generateRoutesModule } from './codegen'
import { type BuildManifestResult, buildManifest, type RouteNode } from './manifest'

const fixture = (overrides: Partial<RouteNode>): RouteNode => ({
  path: '/',
  file: 'index.tsx',
  isIndex: true,
  isLayout: false,
  params: [],
  children: [],
  ...overrides,
})

const buildResult = (overrides: Partial<BuildManifestResult>): BuildManifestResult => ({
  routes: [],
  ...overrides,
})

describe('generateRoutesModule', () => {
  it('should import Route and Router from @solidjs/router', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain('@solidjs/router')
    expect(out).toMatch(/\bRoute\b/)
    expect(out).toMatch(/\bRouter\b/)
  })

  it('should import createComponent from solid-js', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain(`import { createComponent } from 'solid-js'`)
  })

  it('should use import.meta.glob with eager: true for app/pages modules', () => {
    const out = generateRoutesModule(buildResult({}))
    expect(out).toContain(`import.meta.glob('/app/pages/**/*.tsx', { eager: true })`)
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

  it('should reference the module by file path and use .default', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    expect(out).toContain(`"/app/pages/about.tsx"`)
    expect(out).toContain(`.default`)
  })
})

describe('generateRoutesModule — nested layouts', () => {
  it('should NOT emit get children() for routes without children (besides the wrapper Router)', () => {
    const result = buildResult({
      routes: [fixture({ path: '/about', file: 'about.tsx', isIndex: false })],
    })
    const out = generateRoutesModule(result)
    const matches = out.match(/get children\(\)/g) ?? []
    expect(matches).toHaveLength(1)
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
    expect(matches).toHaveLength(2)
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
    expect(childMatches).toHaveLength(3)

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
