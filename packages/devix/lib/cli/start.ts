import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { resolve, join } from 'node:path'
import type { Manifest } from 'vite'
import { registerApiRoutes, registerSsrRoute } from '../server/routes'
import {pathToFileURL} from "node:url"
import {loadConfig} from "../utils/load-config"
import { handleServerFunction } from '../data/server-fn-handler.js'
import type { RouterEvent } from '../data/request-context.js'

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

let renderModule: any
let apiModule: any
let manifest: Manifest
let runtimeConfig: { port: number, host: string | boolean, loaderTimeout: number, output: 'server' | 'static' }

try {
    runtimeConfig = JSON.parse(readFileSync(join(process.cwd(), 'dist/devix.config.json'), 'utf-8'))
    if (runtimeConfig.output !== 'static') {
        renderModule = await import(pathToFileURL(resolve(process.cwd(), 'dist/server/render.js')).href)
        apiModule = await import(pathToFileURL(resolve(process.cwd(), 'dist/server/api.js')).href)
    }
    manifest = JSON.parse(readFileSync(join(process.cwd(), 'dist/client/.vite/manifest.json'), 'utf-8'))
} catch {
    console.error('[devix] Build not found. Run "devix build" first.')
    process.exit(1)
}

const port = Number(process.env.PORT) || runtimeConfig!.port || 3000
const host = typeof runtimeConfig!.host === 'string'
    ? runtimeConfig!.host
    : runtimeConfig!.host ? '0.0.0.0' : (process.env.HOST || '0.0.0.0')

const app = new Hono()

const clientRoot = join(process.cwd(), 'dist/client')

if (runtimeConfig!.output === 'static') {
    app.get('/_devix/data/*', (c: Context) => {
        const pathname = c.req.path.replace(/^\/_devix\/data/, '') || '/'
        const filePath = pathname === '/'
            ? join(clientRoot, '_devix/data/index.turbo')
            : join(clientRoot, '_devix/data', `${pathname}.turbo`)

        try {
            const buf = readFileSync(filePath)
            return new Response(buf, {
                headers: {'Content-Type': 'application/octet-stream'}
            })
        } catch {
            return c.json({ error: 'not found' }, 404)
        }
    })
}

app.use('/*', serveStatic({
    root: clientRoot,
    onFound: (_path, c) => {
        c.header('Cache-Control', _path.includes('/assets/')
            ? 'public, immutable, max-age=31536000'
            : 'no-cache')
    }
}))

if (runtimeConfig!.output === 'static') {
    console.log('[devix] Static mode — serving pre-generated files from dist/client')
} else {
    const userConfig = await loadConfig(process.cwd(), 'production').catch(() => null)
    registerApiRoutes(app, { renderModule, apiModule, manifest })
    registerSsrRoute(app, { renderModule, apiModule, manifest, loaderTimeout: runtimeConfig!.loaderTimeout })

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
}

serve({ fetch: app.fetch, port, hostname: host }, (info: {address: string; port: number}) => console.log(`http://${info.address}:${info.port}`))

export { }