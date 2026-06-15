import type { JSX } from 'solid-js'
import { createComponent } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { ViteDevServer } from 'vite'

type ManifestChunk = {
  file?: string
  css?: string[]
  imports?: string[]
  dynamicImports?: string[]
}

function createStyleLink(href: string): JSX.Element {
  return createComponent(Dynamic, {
    component: 'link',
    rel: 'stylesheet',
    href,
  })
}

export function collectManifestStyles(
  manifest: Record<string, ManifestChunk>,
  entryKey = 'devix:build-entry:entry-client',
): JSX.Element[] {
  const links: JSX.Element[] = []
  const visitedChunks = new Set<string>()
  const seenHrefs = new Set<string>()
  const queue = [entryKey]

  while (queue.length > 0) {
    const key = queue.shift()!
    if (visitedChunks.has(key)) continue
    visitedChunks.add(key)

    const chunk = manifest[key]
    if (!chunk) continue

    for (const cssFile of chunk.css ?? []) {
      const href = `/${cssFile}`
      if (seenHrefs.has(href)) continue
      seenHrefs.add(href)
      links.push(createStyleLink(href))
    }

    queue.push(...(chunk.imports ?? []), ...(chunk.dynamicImports ?? []))
  }

  return links
}

export function collectDevStyles(server: ViteDevServer): JSX.Element[] {
  const seen = new Set<string>()
  const links: JSX.Element[] = []

  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const id = mod.id ?? mod.url
    if (!id || !id.endsWith('.css')) continue
    if (seen.has(id)) continue
    seen.add(id)
    const href = `${mod.url || id}?direct`
    links.push(createStyleLink(href))
  }

  return links
}
