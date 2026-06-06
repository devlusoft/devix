import type { Plugin } from 'vite'
import { renderSSR } from './render'

export function devixServer(): Plugin {
  return {
    name: 'devix:server',
    apply: 'serve',

    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()

          const url = req.url ?? '/'
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

          if (req.method === 'HEAD') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end()
            return
          }

          try {
            await renderSSR(server, url, res)
          } catch (err) {
            server.ssrFixStacktrace(err as Error)
            next(err)
          }
        })
      }
    },
  }
}
