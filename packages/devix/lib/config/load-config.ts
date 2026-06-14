import { existsSync, readFileSync } from 'node:fs'
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
    port: userConfig.port ?? DEFAULTS.port,
    host: userConfig.host ?? DEFAULTS.host,
    output: userConfig.output ?? DEFAULTS.output,
    vite: userConfig.vite ?? {},
  }
}

export type RuntimeConfig = {
  port: number
  host: string
  output: 'server' | 'static'
}

const RUNTIME_DEFAULTS: RuntimeConfig = {
  port: 3000,
  host: '0.0.0.0',
  output: 'server',
}

export function loadRuntimeConfig(distDir: string): RuntimeConfig {
  const configPath = join(distDir, 'devix.config.json')
  if (!existsSync(configPath)) return RUNTIME_DEFAULTS
  try {
    const raw = readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<RuntimeConfig>
    return {
      port: parsed.port ?? RUNTIME_DEFAULTS.port,
      host: parsed.host ?? RUNTIME_DEFAULTS.host,
      output: parsed.output ?? RUNTIME_DEFAULTS.output,
    }
  } catch {
    return RUNTIME_DEFAULTS
  }
}
