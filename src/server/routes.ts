import type {Context, Hono} from 'hono'
import type {ContentfulStatusCode, RedirectStatusCode} from 'hono/utils/http-status'
import type {Manifest} from 'vite'
import {errorToBody} from "../utils/response"
import type {ServerBackendConfig} from "../config"
import {handleProxyRequest} from "./server-proxy"
import {Readable} from "node:stream";
import {safeJsonStringify} from "../utils/html";
import {createTurboResponse} from "../utils/turbo-serializer";
import {getQueryRegistry} from "../runtime/query";

interface ServerOptions {
    renderModule: any
    apiModule: any
    actionsModule?: any
    manifest?: Manifest
    loaderTimeout?: number
    server?: Record<string, ServerBackendConfig>
}

export function registerApiRoutes(app: Hono, {apiModule, renderModule, loaderTimeout, server, actionsModule}: ServerOptions) {
    if (server) {
        app.all('/_devix/server/*', async (c: Context) => {
            try {
                return await handleProxyRequest(c.req.raw, server)
            } catch (e) {
                console.error('[devix] proxy fatal error:', e)
                return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
            }
        })
    }

    app.all('/api/*', async (c: Context) => {
        try {
            return await apiModule.handleApiRequest(c.req.url, c.req.raw, server)
        } catch (e) {
            console.error(e)
            return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
        }
    })

    app.get('/_devix/data/*', async (c: Context) => {
        try {
            const {pathname, search} = new URL(c.req.url, 'http://localhost')
            const url = pathname.replace(/^\/_devix\/data/, '') + search

            const data = await renderModule.runLoader(url, c.req.raw, {loaderTimeout, server})
            if (data.error) return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
            if ('loaderError' in data) {
                const body = errorToBody(data.loaderError)
                return c.json(body, body.statusCode as ContentfulStatusCode)
            }

            return createTurboResponse(data, c.req.raw.signal)
        } catch (e) {
            console.error(e)
            return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
        }
    })

    app.post('/_devix/query', async (c: Context) => {
        try {
            const registry = getQueryRegistry()
            const body = await c.req.json() as Array<{name: string, args: unknown[]}>
            const results: Record<string, unknown> = {}
            for (const {name, args} of body) {
                const fn = registry.get(name)
                if (!fn) {
                    results[name] = {error: `Query "${name}" not found`}
                    continue
                }
                results[name] = await fn(...(args ?? []))
            }
            return c.json(results)
        } catch (e) {
            console.error('[devix] query RPC error:', e)
            return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
        }
    })

    if (actionsModule) {
        app.post('/_devix/actions/*', async (c: Context) => {
            try {
                return await actionsModule.handleActionRequest(c.req.url, c.req.raw)
            } catch (e) {
                console.error('[devix] action error:', e)
                return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
            }
        })
    }
}

export function registerSsrRoute(app: Hono, {renderModule, manifest, loaderTimeout, server}: ServerOptions) {
    app.get('*', async (c: Context) => {
        try {
            const {stream, statusCode, headers} = await renderModule.renderStream(c.req.url, c.req.raw, {
                manifest,
                loaderTimeout,
                server
            })
            const webStream = Readable.toWeb(stream) as ReadableStream
            return new Response(webStream, {
                status: statusCode,
                headers: {'Content-Type': 'text/html', ...headers}
            })
        } catch (e: any) {
            if (e?.name === 'RedirectError') {
                return c.redirect(e.url, e.status as RedirectStatusCode)
            }
            if (e?.name === 'NotFoundError') {
                return c.text('Not Found', 404)
            }
            if (e?.name === 'LoaderError') {
                const dataScript = `<script>window.__DEVIX__=${safeJsonStringify({
                    metadata: null, viewport: undefined, clientEntry: ''
                })};window.__LOADER_DATA__=null;window.__LAYOUTS_DATA__=[];window.__LOADER_ERROR__=${safeJsonStringify(e.body)};</script>`
                const html = `<html lang="en"><head><meta charset="utf-8">${dataScript}</head><body><div id="devix-root"></div></body></html>`
                return c.html(html, e.statusCode as ContentfulStatusCode)
            }
            console.error(e)
            return c.text('Internal Server Error', 500)
        }
    })
}
