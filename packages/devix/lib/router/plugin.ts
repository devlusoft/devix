import { resolve } from 'node:path'
import { glob } from 'tinyglobby'
import type { Plugin } from 'vite'
import { generateRoutesModule } from './codegen'
import { buildManifest } from './manifest'

const ROUTES_VIRTUAL = 'virtual:devix-routes'
const RESOLVED_VIRTUAL = `\0${ROUTES_VIRTUAL}`
const HYDRATION_VIRTUAL = 'virtual:devix-hydration'
const RESOLVED_HYDRATION_VIRTUAL = `\0${HYDRATION_VIRTUAL}`

export function router(): Plugin {
  let root: string

  const isPageFile = (file: string): boolean =>
    file.startsWith(`${root}/app/pages/`) && file.endsWith('.tsx')

  const isRootFile = (file: string): boolean => file === `${root}/app/root.tsx`

  return {
    name: 'devix:router',

    configResolved(config) {
      root = config.root
    },

    resolveId(id) {
      if (id === ROUTES_VIRTUAL) return RESOLVED_VIRTUAL
      if (id === HYDRATION_VIRTUAL) return RESOLVED_HYDRATION_VIRTUAL
    },

    async load(id) {
      if (id === RESOLVED_HYDRATION_VIRTUAL) {
        return `import { hydrateApp } from '@devlusoft/devix'
    import Root from '/app/root.tsx'
    import Routes from 'virtual:devix-routes'
    
    hydrateApp(Root, Routes)`
      }

      if (id === RESOLVED_VIRTUAL) {
        const files = await glob('**/*.tsx', { cwd: resolve(root, 'app/pages') })
        return generateRoutesModule(buildManifest({ files }))
      }
    },

    configureServer(server) {
      const invalidateAndReload = (file: string) => {
        if (!isPageFile(file)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }

      server.watcher.on('add', invalidateAndReload)
      server.watcher.on('unlink', invalidateAndReload)
    },

    handleHotUpdate({ file, server }) {
      if (isPageFile(file)) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL)
        if (!mod) return
        server.moduleGraph.invalidateModule(mod)
        return [mod]
      }

      if (isRootFile(file)) {
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}
