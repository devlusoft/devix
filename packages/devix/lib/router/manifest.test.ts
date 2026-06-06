import { describe, expect, it } from 'vitest'
import { buildManifest, ManifestError } from './manifest'

describe('buildManifest — root', () => {
  it('should map index.tsx to /', () => {
    const { routes } = buildManifest({ files: ['index.tsx'] })
    expect(routes).toEqual([
      { path: '/', file: 'index.tsx', isIndex: true, isLayout: false, params: [], children: [] },
    ])
  })

  it('should map about.tsx to /about', () => {
    expect(buildManifest({ files: ['about.tsx'] }).routes).toEqual([
      {
        path: '/about',
        file: 'about.tsx',
        isIndex: false,
        isLayout: false,
        params: [],
        children: [],
      },
    ])
  })
})

describe('buildManifest — nested', () => {
  it('should map blog/index.tsx to /blog', () => {
    expect(buildManifest({ files: ['blog/index.tsx'] }).routes).toEqual([
      {
        path: '/blog',
        file: 'blog/index.tsx',
        isIndex: true,
        isLayout: false,
        params: [],
        children: [],
      },
    ])
  })

  it('should map blog/[slug].tsx to /blog/:slug', () => {
    expect(buildManifest({ files: ['blog/[slug].tsx'] }).routes).toEqual([
      {
        path: '/blog/:slug',
        file: 'blog/[slug].tsx',
        isIndex: false,
        isLayout: false,
        params: ['slug'],
        children: [],
      },
    ])
  })
})

describe('buildManifest — layouts', () => {
  it('should mark layout.tsx as isLayout', () => {
    const { routes } = buildManifest({ files: ['blog/layout.tsx'] })
    expect(routes[0].isLayout).toBe(true)
    expect(routes[0].path).toBe('/blog')
  })

  it('should nest index.tsx as child of sibling layout.tsx', () => {
    const { routes } = buildManifest({
      files: ['blog/layout.tsx', 'blog/index.tsx'],
    })
    expect(routes).toEqual([
      {
        path: '/blog',
        file: 'blog/layout.tsx',
        isIndex: false,
        isLayout: true,
        params: [],
        children: [
          {
            path: '/',
            file: 'blog/index.tsx',
            isIndex: true,
            isLayout: false,
            params: [],
            children: [],
          },
        ],
      },
    ])
  })

  it('should nest dynamic [slug].tsx as child of sibling layout.tsx', () => {
    const { routes } = buildManifest({
      files: ['blog/layout.tsx', 'blog/[slug].tsx'],
    })
    expect(routes[0].children).toEqual([
      {
        path: '/:slug',
        file: 'blog/[slug].tsx',
        isIndex: false,
        isLayout: false,
        params: ['slug'],
        children: [],
      },
    ])
  })

  it('should nest index and dynamic siblings together under layout', () => {
    const { routes } = buildManifest({
      files: ['blog/layout.tsx', 'blog/index.tsx', 'blog/[slug].tsx'],
    })
    expect(routes[0].file).toBe('blog/layout.tsx')
    expect(routes[0].isLayout).toBe(true)
    expect(routes[0].children).toHaveLength(2)
    expect(routes[0].children.map((c) => c.path).sort()).toEqual(['/', '/:slug'])
  })

  it('should compose nested layouts (blog/layout + blog/posts/layout)', () => {
    const { routes } = buildManifest({
      files: ['blog/layout.tsx', 'blog/posts/layout.tsx', 'blog/posts/index.tsx'],
    })
    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('/blog')
    expect(routes[0].isLayout).toBe(true)
    expect(routes[0].children).toHaveLength(1)

    const postsLayout = routes[0].children[0]
    expect(postsLayout.path).toBe('/posts')
    expect(postsLayout.file).toBe('blog/posts/layout.tsx')
    expect(postsLayout.isLayout).toBe(true)
    expect(postsLayout.children).toHaveLength(1)
    expect(postsLayout.children[0].path).toBe('/')
    expect(postsLayout.children[0].file).toBe('blog/posts/index.tsx')
  })

  it('should wrap all top-level routes when layout exists at pages root', () => {
    const { routes } = buildManifest({
      files: ['layout.tsx', 'index.tsx', 'about.tsx'],
    })
    expect(routes).toHaveLength(1)
    expect(routes[0].file).toBe('layout.tsx')
    expect(routes[0].path).toBe('/')
    expect(routes[0].isLayout).toBe(true)
    expect(routes[0].children).toHaveLength(2)
    expect(routes[0].children.map((c) => c.path).sort()).toEqual(['/', '/about'])
  })

  it('should wrap pages of a (group) under group layout, stripping group from URL', () => {
    const { routes } = buildManifest({
      files: ['(marketing)/layout.tsx', '(marketing)/pricing.tsx'],
    })
    expect(routes).toHaveLength(1)
    expect(routes[0].file).toBe('(marketing)/layout.tsx')
    expect(routes[0].path).toBe('/')
    expect(routes[0].isLayout).toBe(true)
    expect(routes[0].children).toHaveLength(1)
    expect(routes[0].children[0].path).toBe('/pricing')
  })

  it('should keep paths absolute when a directory has no layout', () => {
    const { routes } = buildManifest({
      files: ['blog/index.tsx', 'blog/[slug].tsx'],
    })
    expect(routes).toHaveLength(2)
    expect(routes.map((r) => r.path).sort()).toEqual(['/blog', '/blog/:slug'])
  })

  it('should attach sub-route to closest ancestor layout when intermediate dir has no layout', () => {
    const { routes } = buildManifest({
      files: ['blog/layout.tsx', 'blog/posts/index.tsx'],
    })
    expect(routes).toHaveLength(1)
    expect(routes[0].file).toBe('blog/layout.tsx')
    expect(routes[0].children).toHaveLength(1)
    expect(routes[0].children[0].path).toBe('/posts')
    expect(routes[0].children[0].file).toBe('blog/posts/index.tsx')
  })

  it('should NOT throw COLLISION when layout.tsx and index.tsx coexist in same directory', () => {
    expect(() => buildManifest({ files: ['blog/layout.tsx', 'blog/index.tsx'] })).not.toThrow()
  })
})

describe('buildManifest — groups', () => {
  it('should strip (group) from URL in (marketing)/pricing.tsx', () => {
    expect(buildManifest({ files: ['(marketing)/pricing.tsx'] }).routes).toEqual([
      {
        path: '/pricing',
        file: '(marketing)/pricing.tsx',
        isIndex: false,
        isLayout: false,
        params: [],
        children: [],
      },
    ])
  })
})

describe('buildManifest — catch-all', () => {
  it('should map files/[...rest].tsx to /files/* with rest param', () => {
    expect(buildManifest({ files: ['files/[...rest].tsx'] }).routes).toEqual([
      {
        path: '/files/*',
        file: 'files/[...rest].tsx',
        isIndex: false,
        isLayout: false,
        params: ['rest'],
        children: [],
      },
    ])
  })
})

describe('buildManifest — errors', () => {
  it('should throw ManifestError on path collision', () => {
    expect(() => buildManifest({ files: ['blog/index.tsx', 'blog/(group)/index.tsx'] })).toThrow(
      ManifestError,
    )
  })
})
