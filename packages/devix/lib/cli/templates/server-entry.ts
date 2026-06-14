import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleServerFunction, type ServerFnResponse } from '@devlusoft/devix/data'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = new Hono()

app.use(
  '/*',
  serveStatic({
    root: './client',
    rewriteRequestPath: (path) => (path === '/' ? '/index.html' : path),
  }),
)

app.post('/_server', async (c) => {
  const response: { status: number; headers: Headers; body: string } = {
    status: 0,
    headers: new Headers(),
    body: '',
  }
  await handleServerFunction(c.req.raw, (r: ServerFnResponse) => {
    response.status = r.status
    response.headers = r.headers
    response.body = r.body
  })
  return new Response(response.body, { status: response.status, headers: response.headers })
})

app.get('/*', async (c) => {
  const mod = await import('./render.js')
  return mod.handle(c.req.raw)
})

export default app
