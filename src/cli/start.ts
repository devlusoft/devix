import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { resolve, join } from 'node:path'
import type { Manifest } from 'vite'
import { registerApiRoutes, registerSsrRoute } from '../server/routes'
import { loadDotenv } from '../utils/env'
import {pathToFileURL} from "node:url"

loadDotenv('production')

let renderModule: any
let apiModule: any
let manifest: Manifest
let runtimeConfig: { port: number, host: string | boolean, loaderTimeout: number, output: 'server' | 'static' }

try {
    runtimeConfig = JSON.parse(readFileSync(pathToFileURL(join(process.cwd(), 'dist/devix.config.jso')).href, 'utf-8'))
    if (runtimeConfig.output !== 'static') {
        renderModule = await import(pathToFileURL(resolve(process.cwd(), 'dist/server/render.js')).href)
        apiModule = await import(pathToFileURL(resolve(process.cwd(), 'dist/server/api.js')).href)
    }
    manifest = JSON.parse(readFileSync(pathToFileURL(join(process.cwd(), 'dist/client/.vite/manifest.json')), 'utf-8'))
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
    app.get('/_data/*', (c) => {
        const pathname = c.req.path.replace(/^\/_data/, '') || '/'
        const filePath = pathname === '/'
            ? join(clientRoot, '_data/index.json')
            : join(clientRoot, '_data', `${pathname}.json`)

        try {
            const data = readFileSync(filePath, 'utf-8')
            return c.json(JSON.parse(data))
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
    registerApiRoutes(app, { renderModule, apiModule, manifest })
    registerSsrRoute(app, { renderModule, apiModule, manifest, loaderTimeout: runtimeConfig!.loaderTimeout })
}

serve({ fetch: app.fetch, port, hostname: host }, (info) => console.log(`http://${info.address}:${info.port}`))

export { }