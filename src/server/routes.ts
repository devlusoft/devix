import type {Hono} from 'hono'
import type {Manifest} from 'vite'

interface ServerOptions {
    renderModule: any
    apiModule: any
    manifest?: Manifest
    loaderTimeout?: number
}

export function registerApiRoutes(app: Hono, {apiModule, renderModule, loaderTimeout}: ServerOptions) {
    app.all('/api/*', async (c) => {
        try {
            return await apiModule.handleApiRequest(c.req.url, c.req.raw)
        } catch (e) {
            console.error(e)
            return c.json({error: 'internal error'}, 500)
        }
    })

    app.get('/_data/*', async (c) => {
        try {
            const {pathname, search} = new URL(c.req.url, 'http://localhost')
            const url = pathname.replace(/^\/_data/, '') + search

            const data = await renderModule.runLoader(url, c.req.raw, {loaderTimeout})
            if (data.error) return c.json({error: 'internal error'}, 500)
            if ('loaderError' in data) {
                const {statusCode, message, data: errorData} = data.loaderError
                return c.json({statusCode, message, data: errorData}, statusCode)
            }
            return c.json(data)
        } catch (e) {
            console.error(e)
            return c.json({error: 'internal error'}, 500)
        }
    })
}

export function registerSsrRoute(app: Hono, {renderModule, manifest, loaderTimeout}: ServerOptions) {
    app.get('*', async (c) => {
        try {
            const {html, statusCode, headers} = await renderModule.render(c.req.url, c.req.raw, {manifest, loaderTimeout})
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