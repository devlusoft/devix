import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleServerFunction, type ServerFnResponse } from '../data/server-fn-handler'
import { renderSSR } from './render'

export function devixServer(): Plugin {
  return {
    name: 'devix:server',
    apply: 'serve',

    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url ?? '/'
          const method = req.method ?? 'GET'

          if (method === 'POST' && url.split('?')[0] === '/_server') {
            await dispatchServerFn(req, res)
            return
          }

          if (method !== 'GET' && method !== 'HEAD') return next()

          if (url.startsWith('/@') || url.startsWith('/node_modules/') || url.startsWith('/__')) {
            return next()
          }

          const pathOnly = url.split('?')[0]
          const extMatch = pathOnly.match(/\.([a-z0-9]+)$/i)
          if (extMatch && extMatch[1].toLowerCase() !== 'html') {
            return next()
          }

          const accept = req.headers.accept ?? ''
          if (!accept.includes('text/html') && !accept.includes('*/*')) {
            return next()
          }

          if (method === 'HEAD') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end()
            return
          }

          try {
            await renderSSR({ server, url, res })
          } catch (err) {
            server.ssrFixStacktrace(err as Error)
            next(err)
          }
        })
      }
    },
  }
}

async function dispatchServerFn(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
    }
  }

  const webReq = new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method ?? 'POST',
    headers,
    body,
  })

  const response: ServerFnResponse = {
    status: 0,
    headers: new Headers(),
    body: '',
  }
  await handleServerFunction(webReq, (r) => {
    response.status = r.status
    response.headers = r.headers
    response.body = r.body
  })

  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value)
  }
  res.end(response.body)
}
