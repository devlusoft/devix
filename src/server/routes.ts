import type {Context, Hono} from 'hono'
import type {ContentfulStatusCode, RedirectStatusCode} from 'hono/utils/http-status'
import type {Manifest} from 'vite'
import {errorToBody} from "../utils/response"
import type {ServerBackendConfig} from "../config"
import {handleProxyRequest} from "./server-proxy"
import {Readable} from "node:stream";
import {safeJsonStringify} from "../utils/html";
import {createTurboResponse, decodeFromRequest} from "../utils/turbo-serializer";
import {getQueryRegistry} from "../runtime/query";
import {runWithQueryCache} from "./query-cache";
import {__setFrame} from "../runtime/request-context";
import {devixLog} from "../utils/log";

interface ServerOptions {
    renderModule: any
    apiModule: any
    actionsModule?: any
    manifest?: Manifest
    server?: Record<string, ServerBackendConfig>
}

export function registerApiRoutes(app: Hono, {apiModule, renderModule, server, actionsModule}: ServerOptions) {
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

            const data = await renderModule.runLoader(url, c.req.raw, {server})
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
        const t = Date.now()
        try {
            const registry = getQueryRegistry()
            const body = await decodeFromRequest(c.req.raw) as Array<{name: string, args: unknown[]}>
            const results: Record<string, unknown> = {}
            const responseHeaders = new Headers()

            __setFrame({request: c.req.raw, responseHeaders})
            try {
                await runWithQueryCache(async () => {
                    for (const {name, args} of body) {
                        const fn = registry.get(name)
                        if (!fn) {
                            results[name] = {error: `Query "${name}" not found`}
                            continue
                        }
                        results[name] = await fn(...(args ?? []))
                    }
                }, undefined, c.req.raw, responseHeaders)
            } finally {
                __setFrame(null)
            }

            const res = createTurboResponse(results)
            for (const [k, v] of responseHeaders.entries()) {
                res.headers.append(k, v)
            }
            const ms = Date.now() - t
            devixLog.info(`200 POST /_devix/query [${body.map(b => b.name).join(', ')}] ${ms}ms`)
            return res
        } catch (e) {
            console.error('[devix] query RPC error:', e)
            const ms = Date.now() - t
            devixLog.info(`500 POST /_devix/query [error] ${ms}ms`)
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

export function registerSsrRoute(app: Hono, {renderModule, manifest, server}: ServerOptions) {
    app.get('*', async (c: Context) => {
        try {
            const {stream, statusCode, headers} = await renderModule.renderStream(c.req.url, c.req.raw, {
                manifest,
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
                const errorScript = `<script>window.__LOADER_ERROR__=${safeJsonStringify(e.body)};</script>`
                const html = `<html lang="en"><head><meta charset="utf-8">${errorScript}</head><body><div id="devix-root"></div></body></html>`
                return c.html(html, e.statusCode as ContentfulStatusCode)
            }
            console.error(e)
            return c.text('Internal Server Error', 500)
        }
    })
}
