import { createServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { getRequestListener } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { devix } from '../vite'
import { registerApiRoutes } from '../server/routes'
import { printDevBanner } from "../utils/banner"
import { collectCss } from "../server/collect-css"
import { parseDuration } from "../utils/duration"
import {loadConfig} from "../utils/load-config";
import { handleServerFunction } from '../data/server-fn-handler.js'
import type { RouterEvent } from '../data/request-context.js'
import { logRequest } from './logger.js'

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  for (const pair of cookieHeader.split(';')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (name) cookies[name] = decodeURIComponent(value)
  }
  return cookies
}

function createEvent(request: Request): RouterEvent {
  return {
    cookies: () => parseCookies(request.headers.get('cookie')),
    pathname: new URL(request.url).pathname,
  }
}

const VIRTUAL_RENDER = 'virtual:devix/render'
const VIRTUAL_API = 'virtual:devix/api'
const VIRTUAL_ACTIONS = 'virtual:devix/actions'

const config = await loadConfig(process.cwd(), 'development')
const port = Number(process.env.PORT) || config.port || 3000
const host = typeof config.host === 'string' ? config.host : config.host ? '0.0.0.0' : 'localhost'
const startedAt = Date.now()

const vite = await createViteServer({
  ...devix(config),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
})

const renderModule = {
  render: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).render(...args),
  runLoader: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).runLoader(...args),
}
const apiModule = {
  handleApiRequest: async (...args: any[]) => (await
    vite.ssrLoadModule(VIRTUAL_API)).handleApiRequest(...args),
}
const actionsModule = {
  handleActionRequest: async (...args: any[]) => (await
    vite.ssrLoadModule(VIRTUAL_ACTIONS)).handleActionRequest(...args),
}

const app = new Hono()
registerApiRoutes(app, { renderModule, apiModule, actionsModule, server: config.server })

app.post('/_devix/server', async (c) => {
  let status = 200
  let body = ''
  let headers: Record<string, string> = {}
  await handleServerFunction(
    c.req.raw,
    (r) => {
      status = r.status
      body = r.body
      headers = r.headers ?? {}
    },
    () => createEvent(c.req.raw),
  )
  return new Response(body, { status, headers })
})

app.get('*', async (c: Context) => {
  try {
    const { html, statusCode, headers } = await renderModule.render(c.req.url, c.req.raw, {
      loaderTimeout: parseDuration(config.loaderTimeout ?? 10_000),
      server: config.server,
    })
    const cssUrls = await collectCss(vite)
    const cssLinks = cssUrls.map(url => `<link rel="stylesheet" href="${url}">`).join('\n')
    const htmlWithCss = cssLinks ? html.replace('</head>', `${cssLinks}\n</head>`) : html
    const transformed = await vite.transformIndexHtml(c.req.url, `<!DOCTYPE html>${htmlWithCss}`)
    const res = c.html(transformed, statusCode)
    for (const [key, value] of Object.entries(headers as Record<string, string>)) {
      res.headers.set(key, value)
    }
    return res
  } catch (e) {
    vite.ssrFixStacktrace(e as Error)
    console.error(e)
    return c.text('Internal Server Error', 500)
  }
})

const honoHandler = getRequestListener(app.fetch)
createServer(async (req, res) => {
  const start = Date.now()
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'
  const shouldLog = !url.startsWith('/@') && !url.startsWith('/node_modules/') && !url.startsWith('/__vite_ping')

  res.on('finish', () => {
    if (!shouldLog) return
    const rawId = req.headers['x-server-id']
    const rawPage = req.headers['x-page-path']
    const label = Array.isArray(rawId) ? rawId[0] : rawId
    const pagePath = Array.isArray(rawPage) ? rawPage[0] : rawPage
    logRequest(method, url, res.statusCode, Date.now() - start, label, pagePath)
  })

  await new Promise<void>(resolve => vite.middlewares(req, res, resolve))
  if (!res.writableEnded) await honoHandler(req, res)
}).listen(port, host, () => {
  printDevBanner(port, Date.now() - startedAt)
})

export { }
