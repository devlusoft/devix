import type { Plugin } from 'vite'
import { handleServerFunction } from '../data/server-fn-handler'
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
            return handleServerFunction(req, res, server)
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
