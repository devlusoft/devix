import solid, { type StartOptions } from '@solidjs/vite-plugin'
import { copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const APP = 'app/app.tsx'
const DOCUMENT = 'app/document.tsx'
const ENTRY_FILES = ['entry-server.tsx', 'entry-client.tsx']
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))

export default function devix(): Plugin[] {
  const start: StartOptions = {}
  let root = process.cwd()

  return [
    {
      name: 'devix',
      enforce: 'pre',
      config(userConfig) {
        root = resolve(userConfig.root ?? process.cwd())
        const entries = join(root, '.devix')
        mkdirSync(entries, {recursive: true})
        for (const file of ENTRY_FILES) {
          copyFileSync(join(PACKAGE_ROOT, 'lib', file), join(entries, file))
        }
        start.entryServer = join(entries, 'entry-server.tsx')
        start.entryClient = join(entries, 'entry-client.tsx')
      },
      resolveId(source) {
        if (source === 'virtual:devix/app') return join(root, APP)
        if (source === 'virtual:devix/document') return join(root, DOCUMENT)
        return null
      }
    },
    ...solid({
      start,
      ssr: true,
    })]
}
