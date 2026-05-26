interface ServerEntryOptions {
    routesPath: string
    envPath: string
    honoServerPath: string
    honoServerStaticPath: string
    honoPath: string
}

export function generateServerEntry({ routesPath, envPath, honoServerPath, honoServerStaticPath, honoPath }: ServerEntryOptions): string {
    return `
import { readFileSync } from 'node:fs'
import { serve } from '${honoServerPath}'
import { serveStatic } from '${honoServerStaticPath}'
import { Hono } from '${honoPath}'
import { resolve, join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerApiRoutes, registerSsrRoute } from '${routesPath}'                                         
import { loadDotenv } from '${envPath}'

loadDotenv('production')

const __dir = dirname(process.argv[1])

let renderModule, apiModule, actionsModule, manifest, runtimeConfig

try {
    runtimeConfig = JSON.parse(readFileSync(resolve(__dir, '../devix.config.json'), 'utf-8'))
    if (runtimeConfig.output !== 'static') {
        renderModule = await import(pathToFileURL(resolve(__dir, 'render.js')).href)
        apiModule = await import(pathToFileURL(resolve(__dir, 'api.js')).href)
        try {
            actionsModule = await import(pathToFileURL(resolve(__dir, 'actions.js')).href)
        } catch { /* actions directory may not exist — skip */ }
    }
    manifest = JSON.parse(readFileSync(resolve(__dir, '../client/.vite/manifest.json'), 'utf-8'))
} catch {
    console.error('✗ devix Build not found — run "devix build" first')
    process.exit(1)
}

const port = Number(process.env.PORT) || runtimeConfig.port || 3000
const host = typeof runtimeConfig.host === 'string'
    ? runtimeConfig.host
    : runtimeConfig.host ? '0.0.0.0' : (process.env.HOST || '0.0.0.0')

const clientRoot = resolve(__dir, '../client')
const app = new Hono()

var _DEV_RESET = '\u001b[0m', _DEV_FOG = '\u001b[2m', _DEV_BOLD = '\u001b[1m', _DEV_GREEN = '\u001b[32m', _DEV_YELLOW = '\u001b[33m', _DEV_RED = '\u001b[31m'
app.use('*', async (c, next) => {
    var _start = Date.now()
    await next()
    var _ms = Date.now() - _start
    var _status = c.res.status
    var _col = _status < 300 ? _DEV_GREEN : _status < 400 ? _DEV_YELLOW : _DEV_RED
    var _time = new Date().toISOString().slice(11, 19)
    console.log(_DEV_FOG + _time + _DEV_RESET + ' ' + _col + _status + _DEV_RESET + ' ' + _DEV_BOLD + c.req.method + _DEV_RESET + ' ' + c.req.path + ' ' + _DEV_FOG + _ms + 'ms' + _DEV_RESET)
})

if (runtimeConfig.output === 'static') {
    app.get('/_devix/data/*', (c) => {
        const pathname = c.req.path.replace(/^\\/_devix\\/data/, '') || '/'
        const filePath = pathname === '/'
            ? join(clientRoot, '_devix/data/index.turbo')
            : join(clientRoot, '_devix/data', pathname + '.turbo')
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

if (runtimeConfig.output === 'static') {
    console.log('● devix Static mode — serving pre-generated files from dist/client')
} else {
    let userServerConfig
    try {
        const userConfigMod = await import(pathToFileURL(resolve(process.cwd(), 'devix.config.ts')).href).catch(() =>
            import(pathToFileURL(resolve(process.cwd(), 'devix.config.js')).href))
        userServerConfig = userConfigMod?.default?.server
    } catch {
        /* config sin server — sigue normal */
    }
    registerApiRoutes(app, { renderModule, apiModule, actionsModule, manifest, server: userServerConfig })
    registerSsrRoute(app, { renderModule, apiModule, manifest, server: userServerConfig })
}

const server = serve({ fetch: app.fetch, port, hostname: host }, (info) =>
    console.log(\`http://\${info.address}:\${info.port}\`))

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
`
}
