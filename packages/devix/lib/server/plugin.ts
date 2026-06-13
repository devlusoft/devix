import type { IncomingMessage, ServerResponse } from 'node:http'
import { deserialize, serialize } from 'seroval'
import type { Plugin } from 'vite'
import { createRequestEvent, runWithRequestEvent } from '../data/request-context'
import { getServerFn } from '../data/server-registry'
import { renderSSR } from './render'

const SERVER_ENDPOINT = '/_server'

export function devixServer(): Plugin {
  return {
    name: 'devix:server',
    apply: 'serve',

    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url ?? '/'
          const method = req.method ?? 'GET'

          if (method === 'POST' && url.split('?')[0] === SERVER_ENDPOINT) {
            await handleServerFn(req, res)
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
            const event = createRequestEvent()
            await runWithRequestEvent(event, () => renderSSR({ server, url, res }))
          } catch (err) {
            server.ssrFixStacktrace(err as Error)
            next(err)
          }
        })
      }
    },
  }
}

async function handleServerFn(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const id = req.headers['x-server-id']
    if (typeof id !== 'string' || id.length === 0) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing X-Server-Id')
      return
    }

    const body = await readBody(req)
    let args: unknown[]
    try {
      args = deserialize(body) as unknown[]
    } catch (err) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`Invalid body: ${(err as Error).message}`)
      return
    }

    let fn: ((...args: unknown[]) => unknown) | undefined
    try {
      fn = getServerFn(id)
    } catch {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`Unknown server function: ${id}`)
      return
    }

    let result: unknown
    try {
      const event = createRequestEvent()
      result = await runWithRequestEvent(event, () => fn(...args))
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`Server function error: ${(err as Error).message}`)
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(serialize(result))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(`Server function error: ${(err as Error).message}`)
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  const chunks: string[] = []
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: unknown) => {
      if (typeof chunk === 'string') {
        chunks.push(chunk)
      } else if (chunk instanceof Uint8Array) {
        chunks.push(new TextDecoder('utf-8').decode(chunk))
      } else {
        chunks.push(String(chunk))
      }
    })
    req.on('end', () => {
      resolve(chunks.join(''))
    })
    req.on('error', (err: unknown) => {
      reject(err)
    })
  })
}
