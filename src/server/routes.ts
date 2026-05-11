import type {Context, Hono} from 'hono'
import type {ContentfulStatusCode} from 'hono/utils/http-status'
import type {Manifest} from 'vite'
import {errorToBody} from "../utils/response"
import type {ServerBackendConfig} from "../config"
import {handleProxyRequest} from "./server-proxy"

interface ServerOptions {
    renderModule: any
    apiModule: any
    manifest?: Manifest
    loaderTimeout?: number
    server?: Record<string, ServerBackendConfig>
}

export function registerApiRoutes(app: Hono, {apiModule, renderModule, loaderTimeout, server}: ServerOptions) {
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

    app.get('/_data/*', async (c: Context) => {
        try {
            const {pathname, search} = new URL(c.req.url, 'http://localhost')
            const url = pathname.replace(/^\/_data/, '') + search

            const data = await renderModule.runLoader(url, c.req.raw, {loaderTimeout, server})
            if (data.error) return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
            if ('loaderError' in data) {
                const body = errorToBody(data.loaderError)
                return c.json(body, body.statusCode as ContentfulStatusCode)
            }
            return c.json(data)
        } catch (e) {
            console.error(e)
            return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
        }
    })
}

export function registerSsrRoute(app: Hono, {renderModule, manifest, loaderTimeout, server}: ServerOptions) {
    app.get('*', async (c: Context) => {
        try {
            const {html, statusCode, headers} = await renderModule.render(c.req.url, c.req.raw, {manifest, loaderTimeout, server})
            const res = c.html(`<!DOCTYPE html>${html}`, statusCode)
            for (const [key, value] of Object.entries(headers as Record<string, string>)) {
                res.headers.set(key, value)
            }
            return res
        } catch (e) {
            console.error(e)
            return c.text('Internal Server Error', 500)
        }
    })
}