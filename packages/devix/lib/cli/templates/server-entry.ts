import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Routes from 'virtual:devix-routes'
import { createRenderFn } from '@devlusoft/devix'
import { logRequest } from '@devlusoft/devix/cli/logger'
import { handleServerFunction, type ServerFnResponse } from '@devlusoft/devix/data'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import Root from '/app/root.tsx'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getClientEntry(): string {
  const manifestPath = join(__dirname, '../client/.vite/manifest.json')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      { file: string; isEntry?: boolean }
    >
    for (const chunk of Object.values(manifest)) {
      if (chunk.isEntry) return `/${chunk.file}`
    }
  } catch {}
  return '/assets/entry-client.js'
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { stream, getHeaders, getStatus, onShellReady } = createRenderFn(
    Root,
    Routes,
    url.pathname,
    getClientEntry(),
  )

  const { readable, writable } = new TransformStream()
  stream.pipeTo(writable)
  await new Promise<void>((resolve) => onShellReady(resolve))

  return new Response(readable, {
    status: getStatus(),
    headers: getHeaders(),
  })
}

const app = new Hono()

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const path = c.req.path
  const isAsset = path.startsWith('/assets/') || path.startsWith('/@') || path === '/favicon.ico'
  if (!isAsset) {
    const label = path === '/_devix/server' ? c.req.header('X-Server-Id') : undefined
    const pagePath = path === '/_devix/server' ? c.req.header('X-Page-Path') : undefined
    logRequest(c.req.method, path, c.res.status, Date.now() - start, label, pagePath)
  }
})

app.use(
  '/*',
  serveStatic({
    root: join(__dirname, '../client'),
    rewriteRequestPath: (path) => (path === '/' ? '/index.html' : path),
  }),
)

app.post('/_devix/server', async (c) => {
  const response: ServerFnResponse = {
    status: 0,
    headers: new Headers(),
    body: '',
  }
  await handleServerFunction(c.req.raw, (r) => {
    response.status = r.status
    response.headers = r.headers
    response.body = r.body
  })
  return new Response(response.body, { status: response.status, headers: response.headers })
})

app.get('/*', async (c) => {
  return handleRequest(c.req.raw)
})

export default app
