import type {ViteDevServer} from 'vite'

export async function collectCss(vite: ViteDevServer): Promise<string[]> {
    const cssUrls = new Set<string>()

    for (const [, mod] of vite.moduleGraph.idToModuleMap) {
        if (!mod.id) continue
        if (mod.id.endsWith('.css') || mod.id.includes('.css?')) {
            cssUrls.add(mod.url)
        }
    }

    return [...cssUrls]
}