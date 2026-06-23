import type {Context, Hono} from 'hono'
import type {ContentfulStatusCode, RedirectStatusCode} from 'hono/utils/http-status'
import type {Manifest} from 'vite'
import {errorToBody} from "../utils/response"
import {Readable} from "node:stream";
import {safeJsonStringify} from "../utils/html";
import {createTurboResponse} from "../utils/turbo-serializer";

interface ServerOptions {
    renderModule: any
    apiModule: any
    actionsModule?: any
    manifest?: Manifest
    loaderTimeout?: number
}

export function registerApiRoutes(app: Hono, {apiModule, renderModule, loaderTimeout, actionsModule}: ServerOptions) {
    app.all('/api/*', async (c: Context) => {
        try {
            return await apiModule.handleApiRequest(c.req.url, c.req.raw)
        } catch (e) {
            console.error(e)
            return c.json({statusCode: 500, message: 'Internal Server Error'}, 500)
        }
    })

    app.get('/_devix/data/*', async (c: Context) => {
        try {
            const {pathname, search} = new URL(c.req.url, 'http://localhost')
            const url = pathname.replace(/^\/_devix\/data/, '') + search

            const data = await renderModule.renderData(url, c.req.raw, {} as never, {loaderTimeout})
            if (data.error) {
                return c.json(data.error, (data.error.statusCode ?? 500) as ContentfulStatusCode)
            }
            if (data.redirect) {
                return c.json({}, data.redirect.status as ContentfulStatusCode, {
                    Location: data.redirect.url,
                })
            }
            if (data.statusCode !== 200) {
                return c.json({statusCode: data.statusCode}, data.statusCode as ContentfulStatusCode)
            }

            return createTurboResponse({
                guardData: data.guardData,
                queryHydration: data.queryHydration,
            }, c.req.raw.signal)
        } catch (e) {
            console.error(e)
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

export function registerSsrRoute(app: Hono, {renderModule, manifest, loaderTimeout}: ServerOptions) {
    app.get('*', async (c: Context) => {
        try {
            const {stream, statusCode, headers} = await renderModule.renderStream(c.req.url, c.req.raw, {
                manifest,
                loaderTimeout,
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
            console.error(e)
            return c.text('Internal Server Error', 500)
        }
    })
}