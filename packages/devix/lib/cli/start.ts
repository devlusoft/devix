import { existsSync } from 'node:fs'
import type { Server } from 'node:http'
import { join } from 'node:path'
import { serve } from '@hono/node-server'
import { loadRuntimeConfig } from '../config/load-config'

type HonoApp = {
  fetch: (req: Request, env?: unknown, ctx?: unknown) => Promise<Response> | Response
}

export async function start(): Promise<void> {
  const cwd = process.cwd()
  const distDir = join(cwd, 'dist')
  const serverEntry = join(distDir, 'server/index.js')

  if (!existsSync(serverEntry)) {
    throw new Error(`devix: ${serverEntry} not found. Run \`devix build\` first.`)
  }

  const cfg = loadRuntimeConfig(distDir)
  const mod = (await import(serverEntry)) as { default: HonoApp }
  const app = mod.default

  const server = serve(
    {
      fetch: app.fetch,
      port: cfg.port,
      hostname: typeof cfg.host === 'string' ? cfg.host : undefined,
    },
    (info) => {
      console.log(`devix: listening on http://${info.address}:${info.port}`)
    },
  )

  const shutdown = (sig: string) => {
    console.log(`devix: ${sig} received, shutting down`)
    const timeout = setTimeout(() => process.exit(0), 5000)
    timeout.unref()
    server.close(() => {
      clearTimeout(timeout)
      process.exit(0)
    })
    ;(server as Server).closeAllConnections?.()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}
