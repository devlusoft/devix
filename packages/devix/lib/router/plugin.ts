import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'tinyglobby'
import type { Plugin } from 'vite'
import { generateRoutesModule } from './codegen'
import { buildManifest } from './manifest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_TEMPLATES_DIR = resolve(__dirname, '../cli/templates')

const ROUTES_VIRTUAL = 'virtual:devix-routes'
const RESOLVED_VIRTUAL = `\0${ROUTES_VIRTUAL}`
const HYDRATION_VIRTUAL = 'virtual:devix-hydration'
const RESOLVED_HYDRATION_VIRTUAL = `\0${HYDRATION_VIRTUAL}`

const BUILD_ENTRIES = ['entry-client', 'index', 'render'] as const
type BuildEntry = (typeof BUILD_ENTRIES)[number]
const RESOLVED_BUILD_ENTRY = (name: BuildEntry) => `\0devix:build-entry:${name}`

const TEMPLATE_FILES: Record<BuildEntry, string> = {
  'entry-client': 'entry-client.tsx',
  index: 'server-entry.ts',
  render: 'server-render.ts',
}

const MODULE_TYPES: Record<BuildEntry, 'ts' | 'tsx'> = {
  'entry-client': 'tsx',
  index: 'ts',
  render: 'ts',
}

const templateCache = new Map<BuildEntry, string>()

function readTemplate(name: BuildEntry): string {
  const cached = templateCache.get(name)
  if (cached) return cached
  const path = resolve(PACKAGE_TEMPLATES_DIR, TEMPLATE_FILES[name])
  if (!existsSync(path)) {
    throw new Error(`devix: template not found at ${path}`)
  }
  const content = readFileSync(path, 'utf8')
  templateCache.set(name, content)
  return content
}

export function router(): Plugin {
  let root: string
  let command: 'dev' | 'build' | 'serve' | undefined

  const isPageFile = (file: string): boolean =>
    file.startsWith(`${root}/app/pages/`) && file.endsWith('.tsx')

  const isRootFile = (file: string): boolean => file === `${root}/app/root.tsx`

  return {
    name: 'devix:router',

    config(_config, env) {
      command = env.command
    },

    configResolved(config) {
      root = config.root
    },

    resolveId(id) {
      if (id === ROUTES_VIRTUAL) return RESOLVED_VIRTUAL
      if (id === HYDRATION_VIRTUAL) return RESOLVED_HYDRATION_VIRTUAL
      if (command === 'build' && (BUILD_ENTRIES as readonly string[]).includes(id)) {
        return RESOLVED_BUILD_ENTRY(id as BuildEntry)
      }
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

      for (const name of BUILD_ENTRIES) {
        if (id === RESOLVED_BUILD_ENTRY(name)) {
          return {
            code: readTemplate(name),
            moduleType: MODULE_TYPES[name],
          }
        }
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
