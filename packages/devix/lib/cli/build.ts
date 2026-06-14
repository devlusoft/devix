import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeConfig, build as viteBuild } from 'vite'
import { loadConfig } from '../config/load-config'
import { preset } from '../vite/preset'

export async function build(): Promise<void> {
  const cwd = process.cwd()
  const config = await loadConfig(cwd)
  const finalConfig = mergeConfig(preset(config, 'build'), config.vite ?? {})

  await viteBuild({
    ...finalConfig,
    configFile: false,
    root: cwd,
    logLevel: 'info',
  })

  const distDir = join(cwd, config.outDir)
  const runtimeCfg = {
    port: config.port,
    host: typeof config.host === 'string' ? config.host : '0.0.0.0',
    output: config.output,
  }
  writeFileSync(join(distDir, 'devix.config.json'), JSON.stringify(runtimeCfg, null, 2))

  const required = ['server/index.js', 'server/render.js', 'devix.config.json']
  const missing = required.filter((p) => !existsSync(join(distDir, p)))
  if (missing.length > 0) {
    throw new Error(`devix: build succeeded but missing outputs: ${missing.join(', ')}`)
  }
}
