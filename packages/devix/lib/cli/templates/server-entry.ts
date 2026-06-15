import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Routes from 'virtual:devix-routes-ssr'
import { createRenderFn } from '@devlusoft/devix'
import { logRequest } from '@devlusoft/devix/cli/logger'
import { handleServerFunction, type ServerFnResponse } from '@devlusoft/devix/data'
import { collectManifestStyles } from '@devlusoft/devix/server/styles'
import { serveStatic } from '@hono/node-server/serve-static'
import type { JSX } from 'solid-js'
import { Hono } from 'hono'
import Root from '/app/root.tsx'

const __dirname = dirname(fileURLToPath(import.meta.url))

type ManifestChunk = {
  file: string
  isEntry?: boolean
  css?: string[]
  imports?: string[]
  dynamicImports?: string[]
}

function readClientManifest(): Record<string, ManifestChunk> | undefined {
  const manifestPath = join(__dirname, '../client/.vite/manifest.json')
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, ManifestChunk>
  } catch {}
  return undefined
}

function getClientEntry(): string {
  const manifest = readClientManifest()
  if (!manifest) return '/assets/entry-client.js'
  for (const chunk of Object.values(manifest)) {
    if (chunk.isEntry) return `/${chunk.file}`
  }
  return '/assets/entry-client.js'
}

function getClientStyles(): JSX.Element[] {
  const manifest = readClientManifest()
  if (!manifest) return []
  return collectManifestStyles(manifest)
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { stream, getHeaders, getStatus, onShellReady } = createRenderFn(
    Root,
    Routes,
    url.pathname,
    { clientEntry: getClientEntry(), styles: getClientStyles() },
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
