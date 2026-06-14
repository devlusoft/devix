import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Spinner } from '@nijil71/lumi-cli'
import { createBuilder, mergeConfig } from 'vite'
import { loadConfig } from '../config/load-config'
import { preset } from '../vite/preset'
import { logError, showBanner } from './logger'

export async function build(): Promise<void> {
  const cwd = process.cwd()
  const config = await loadConfig(cwd)
  const startedAt = Date.now()
  showBanner()

  const spinner = new Spinner({ text: 'building client + server' })
  spinner.start()

  try {
    const distDir = join(cwd, config.outDir)
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true, force: true })
    }

    const finalConfig = mergeConfig(preset(config, 'build'), config.vite ?? {})

    const builder = await createBuilder({
      ...finalConfig,
      configFile: false,
      root: cwd,
      logLevel: 'warn',
    })

    await builder.buildApp()

    const runtimeCfg = {
      port: config.port,
      host: typeof config.host === 'string' ? config.host : '0.0.0.0',
      output: config.output,
    }
    writeFileSync(join(distDir, 'devix.config.json'), JSON.stringify(runtimeCfg, null, 2))

    const required = ['server/index.js', 'devix.config.json']
    const missing = required.filter((p) => !existsSync(join(distDir, p)))
    if (missing.length > 0) {
      throw new Error(`devix: build succeeded but missing outputs: ${missing.join(', ')}`)
    }

    spinner.succeed(`built in ${Date.now() - startedAt}ms`)
  } catch (err) {
    spinner.fail('build failed')
    logError((err as Error).message)
    throw err
  }
}
