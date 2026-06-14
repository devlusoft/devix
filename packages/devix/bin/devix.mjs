#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)

function isDevWorkspace() {
  // The published package only includes `dist` and `bin`; `lib` only exists in the monorepo workspace.
  return existsSync(new URL('../lib/cli/index.ts', import.meta.url))
}

async function importDevixModule(sourcePath) {
  if (isDevWorkspace()) {
    return jiti.import(sourcePath)
  }
  const distPath = sourcePath.replace(/^\.\.\/lib\//, '../dist/').replace(/\.tsx?$/, '.js')
  return import(new URL(distPath, import.meta.url))
}

const { parseCommand } = await importDevixModule('../lib/cli/index.ts')
const cmd = parseCommand(process.argv.slice(2))

if (cmd === 'dev') {
  const { dev } = await importDevixModule('../lib/cli/dev.ts')
  await dev()
} else if (cmd === 'start') {
  const { start } = await importDevixModule('../lib/cli/start.ts')
  await start()
} else {
  const { build } = await importDevixModule('../lib/cli/build.ts')
  await build()
}
