import { createServer, mergeConfig } from 'vite'
import { loadConfig } from '../config/load-config'
import { preset } from '../vite/preset'
import { printBootBanner } from './logger'

export async function dev(): Promise<void> {
  const cwd = process.cwd()
  const config = await loadConfig(cwd)
  const startedAt = Date.now()
  const finalConfig = mergeConfig(preset(config), config.vite ?? {})
  const server = await createServer({ ...finalConfig, root: cwd, logLevel: 'warn' })
  await server.listen()
  const urls = server.resolvedUrls ?? { local: [], network: [] }
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address !== null ? address.port : config.port
  printBootBanner({
    port,
    durationMs: Date.now() - startedAt,
    networkUrl: urls.network?.[0],
  })
}
