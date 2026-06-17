import type { ViteDevServer } from 'vite'
import { describe, expect, it } from 'vitest'
import { collectDevStyles, collectManifestStyles } from './styles'

describe('collectManifestStyles', () => {
  it('returns link tags for css reachable from the entry chunk', () => {
    const manifest = {
      'devix:build-entry:entry-client': {
        file: 'assets/entry-client.js',
        isEntry: true,
        css: ['assets/entry-client.css'],
        dynamicImports: ['app/pages/index.tsx'],
      },
      'app/pages/index.tsx': {
        file: 'assets/pages.js',
        css: ['assets/pages.css'],
      },
    }

    const links = collectManifestStyles(manifest)
    const html = links.join('')

    expect(html).toContain('<link rel="stylesheet" href="/assets/entry-client.css"/>')
    expect(html).toContain('<link rel="stylesheet" href="/assets/pages.css"/>')
  })

  it('returns an empty array when the entry chunk is missing', () => {
    expect(collectManifestStyles({})).toEqual([])
  })

  it('does not duplicate css files visited through multiple paths', () => {
    const manifest = {
      'devix:build-entry:entry-client': {
        file: 'assets/entry-client.js',
        isEntry: true,
        css: ['assets/shared.css'],
        imports: ['shared'],
        dynamicImports: ['route'],
      },
      shared: {
        file: 'assets/shared.js',
        css: ['assets/shared.css'],
      },
      route: {
        file: 'assets/route.js',
        imports: ['shared'],
      },
    }

    const links = collectManifestStyles(manifest)
    const html = links.join('')

    expect((html.match(/shared\.css/g) ?? []).length).toBe(1)
  })
})

describe('collectDevStyles', () => {
  it('returns link tags for every css module in the graph', () => {
    const server = createMockServer([
      { id: '/app/app.css', url: '/app/app.css' },
      { id: '/app/pages/index.css', url: '/app/pages/index.css' },
      { id: '/app/root.tsx', url: '/app/root.tsx' },
    ])

    const links = collectDevStyles(server)
    const html = links.join('')

    expect(html).toContain('<link rel="stylesheet" href="/app/app.css?direct"/>')
    expect(html).toContain('<link rel="stylesheet" href="/app/pages/index.css?direct"/>')
    expect(html).not.toContain('root.tsx')
  })

  it('falls back to module id when url is missing', () => {
    const server = createMockServer([{ id: '/app/app.css' }])
    const links = collectDevStyles(server)
    const html = links.join('')

    expect(html).toContain('<link rel="stylesheet" href="/app/app.css?direct"/>')
  })
})

function createMockServer(modules: Array<{ id?: string; url?: string }>): ViteDevServer {
  const map = new Map<string, { id?: string; url?: string; importedModules: Set<unknown> }>()
  for (const mod of modules) {
    map.set(mod.id ?? mod.url ?? '', { ...mod, importedModules: new Set() })
  }
  return {
    moduleGraph: {
      idToModuleMap: map,
    },
  } as unknown as ViteDevServer
}
