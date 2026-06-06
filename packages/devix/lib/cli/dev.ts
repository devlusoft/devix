import { createServer, mergeConfig } from 'vite'
import { loadConfig } from '../config/load-config'
import { preset } from '../vite/preset'

export async function dev(): Promise<void> {
  const cwd = process.cwd()
  const config = await loadConfig(cwd)
  const finalConfig = mergeConfig(preset(config), config.vite ?? {})
  const server = await createServer({ ...finalConfig, root: cwd })
  await server.listen()
  server.printUrls()
}
