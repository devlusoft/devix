import type { ViteDevServer } from 'vite'

type ManifestChunk = {
  file?: string
  css?: string[]
  imports?: string[]
  dynamicImports?: string[]
}

export function escapeHtml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' })[c] as string,
  )
}

function createStyleLink(href: string): string {
  return `<link rel="stylesheet" href="${escapeHtml(href)}"/>`
}

export function collectManifestStyles(
  manifest: Record<string, ManifestChunk>,
  entryKey = 'devix:build-entry:entry-client',
): string[] {
  const links: string[] = []
  const visitedChunks = new Set<string>()
  const seenHrefs = new Set<string>()
  const queue = [entryKey]

  while (queue.length > 0) {
    const key = queue.shift() as string
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

export function collectDevStyles(server: ViteDevServer): string[] {
  const seen = new Set<string>()
  const links: string[] = []

  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const id = mod.id ?? mod.url
    if (!id?.endsWith('.css')) continue
    if (seen.has(id)) continue
    seen.add(id)
    const href = `${mod.url || id}?direct`
    links.push(createStyleLink(href))
  }

  return links
}
