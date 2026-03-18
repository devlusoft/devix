import {createServer} from 'node:http'
import {createServer as createViteServer} from 'vite'
import {getRequestListener} from '@hono/node-server'
import {Hono} from 'hono'
import type {DevixConfig} from '../config'
import {devix} from '../vite'
import {registerApiRoutes} from '../server/routes'
import {printDevBanner} from "../utils/banner";
import {collectCss} from "../server/collect-css";
import {parseDuration} from "../utils/duration";

const VIRTUAL_RENDER = 'virtual:devix/render'
const VIRTUAL_API = 'virtual:devix/api'

const config: DevixConfig = (await import(`${process.cwd()}/devix.config.ts`)).default
const port = Number(process.env.PORT) || config.port || 3000
const host = typeof config.host === 'string' ? config.host : config.host ? '0.0.0.0' : 'localhost'

const vite = await createViteServer({
    ...devix(config),
    configFile: false,
    appType: 'custom',
    server: {middlewareMode: true},
})

const renderModule = {
    render: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).render(...args),
    runLoader: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_RENDER)).runLoader(...args),
}

const apiModule = {
    handleApiRequest: async (...args: any[]) => (await vite.ssrLoadModule(VIRTUAL_API)).handleApiRequest(...args),
}

const app = new Hono()

registerApiRoutes(app, {renderModule, apiModule})

app.get('*', async (c) => {
    try {
        const {html, statusCode, headers} = await renderModule.render(c.req.url, c.req.raw, {loaderTimeout: parseDuration(config.loaderTimeout ?? 10_000)})

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
    await new Promise<void>(resolve => vite.middlewares(req, res, resolve))
    if (!res.writableEnded) await honoHandler(req, res)
}).listen(port, host, () => {
    printDevBanner(port)
})

export {}