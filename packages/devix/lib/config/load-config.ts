import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createJiti } from 'jiti'
import { DEFAULTS, type DevixConfig, type ResolvedDevixConfig } from './define-config'

export async function loadConfig(cwd: string): Promise<ResolvedDevixConfig> {
  const configPath = join(cwd, 'devix.config.ts')

  let userConfig: DevixConfig = {}

  if (existsSync(configPath)) {
    const jiti = createJiti(import.meta.url)
    const mod = (await jiti.import(configPath)) as { default?: DevixConfig }
    userConfig = mod.default ?? {}
  }

  return {
    outDir: userConfig.outDir ?? DEFAULTS.outDir,
    base: userConfig.base ?? DEFAULTS.base,
    vite: userConfig.vite ?? {},
  }
}
