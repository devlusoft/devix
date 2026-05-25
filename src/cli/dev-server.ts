import { createServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { getRequestListener } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { c, spinner } from '@nijil71/lumi-cli'
import { devix } from '../vite'
import { registerApiRoutes } from '../server/routes'
import { printDevBanner } from "../utils/banner"
import { loadConfig } from "../utils/load-config"
import { devixLog } from "../utils/log"

const devStartTime = Date.now()
const boot = spinner({ type: 'bounce' }).start('devix')
const viteLogOnce = new Set<string>()

const VIRTUAL_RENDER = 'virtual:devix/render'
const VIRTUAL_API = 'virtual:devix/api'
const VIRTUAL_ACTIONS = 'virtual:devix/actions'

boot.setText('Loading config...')
const config = await loadConfig(process.cwd(), 'development')
const port = Number(process.env.PORT) || config.port || 3000
const host = typeof config.host === 'string' ? config.host : config.host ? '0.0.0.0' : 'localhost'

boot.setText('Initializing Vite...')
const vite = await createViteServer({
  ...devix(config),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  customLogger: {
    info: (msg) => devixLog.info(msg),
    warn: (msg) => devixLog.warn(msg),
    warnOnce: (msg) => {
      if (!viteLogOnce.has(msg)) {
        viteLogOnce.add(msg)
        devixLog.warn(msg)
      }
    },
    error: (msg) => devixLog.error(msg),
    clearScreen: () => {},
    hasErrorLogged: () => false,
    hasWarned: false,
  },
})

const renderModule = {
  render: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).render(...args),
  renderDev: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).renderDev(...args),
  runLoader: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).runLoader(...args),
}
const apiModule = {
  handleApiRequest: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_API)).handleApiRequest(...args),
}
const actionsModule = {
  handleActionRequest: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_ACTIONS)).handleActionRequest(...args),
}

const app = new Hono()

app.use('*', async (ctx, next) => {
  if (ctx.req.path === '/_devix/query') return next()
  const t = Date.now()
  await next()
  const ms = Date.now() - t
  const status = ctx.res.status
  const col = status < 300 ? c.sage : status < 400 ? c.amber : c.signal
  console.log(`[devix] ${col}${status}${c.r} ${c.b}${ctx.req.method}${c.r} ${ctx.req.path} ${c.fog}${ms}ms${c.r}`)
})

registerApiRoutes(app, { renderModule, apiModule, actionsModule, server: config.server })

app.get('*', async (c: Context) => {
  try {
    const result = await renderModule.renderDev(c.req.url, c.req.raw, {
      server: config.server,
    })

    const { html, statusCode, headers } = result
    const transformed = await vite.transformIndexHtml(c.req.url, html)

    return new Response(transformed, {
      status: statusCode || 200,
      headers: {
        'Content-Type': 'text/html',
        ...headers,
      },
    })
  } catch (e) {
    vite.ssrFixStacktrace(e as Error)
    console.error(e)
    return new Response('Internal Server Error', { status: 500 })
  }
})

const honoHandler = getRequestListener(app.fetch)
createServer(async (req, res) => {
  await new Promise<void>(resolve => vite.middlewares(req, res, resolve))
  if (!res.writableEnded) await honoHandler(req, res)
}).listen(port, host, () => {
  boot.stop()
  printDevBanner(port, devStartTime)
})

export { }       