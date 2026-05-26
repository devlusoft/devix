import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

interface GenerateEntryServerOptions {
    pagesDir: string
}

export function generateEntryServer(options: GenerateEntryServerOptions): string {
    const {pagesDir} = options

    return `
import {renderToStream, renderToString, ssr, NoHydration, Hydration, HydrationScript, getAssets} from 'solid-js/web'
import {MetaProvider} from '@devlusoft/devix'
import {ErrorBoundary} from 'solid-js'
import {TopErrorBoundary} from '${resolve(__dirname, '../runtime/error-boundary').replace(/\\/g, '/')}'
import App from 'virtual:devix/app'
import DefaultError from '${resolve(__dirname, '../client/default-error').replace(/\\/g, '/')}'
import {__setFrame} from '${resolve(__dirname, '../runtime/request-context').replace(/\\/g, '/')}'
import {resolvePageData, runLoader as _runLoader} from '${resolve(__dirname, '../server/render').replace(/\\/g, '/')}'
import {isRedirect, isLoaderError, errorToBody} from '${resolve(__dirname, '../utils/response').replace(/\\/g, '/')}'
import {runWithQueryCache, QueryCache} from '${resolve(__dirname, '../server/query-cache').replace(/\\/g, '/')}'
import {collectEncode} from '${resolve(__dirname, '../utils/turbo-serializer').replace(/\\/g, '/')}'
import {handleApiRequest as _handleApiRequest} from '${resolve(__dirname, '../server/api').replace(/\\/g, '/')}'
import {handleActionRequest as _handleActionRequest} from '${resolve(__dirname, '../server/actions').replace(/\\/g, '/')}'
import {getQueryRegistry} from '${resolve(__dirname, '../runtime/query').replace(/\\/g, '/')}'
import {decodeFromRequest, createTurboResponse} from '${resolve(__dirname, '../utils/turbo-serializer').replace(/\\/g, '/')}'
import clientAssets from 'virtual:devix/entry-client.jsx?assets=client'

const _pages = import.meta.glob(['/${pagesDir}/**/*.tsx', '!**/error.tsx', '!**/layout.tsx'])
const _layouts = import.meta.glob('/${pagesDir}/**/layout.tsx')

const _rootLayouts = import.meta.glob('/${pagesDir}/layout.tsx', {eager: true, import: 'default'})
const RootLayout = _rootLayouts[Object.keys(_rootLayouts)[0]] || null

const _glob = {
    pages: _pages,
    layouts: _layouts,
    pagesDir: '/${pagesDir}',
}

export default {
    async fetch(request) {
        try {
            return await handleRequest(request)
        } catch (e) {
            console.error('[devix] handler error:', e)
            return new Response('Internal Server Error', {status: 500})
        }
    },
}

async function handleRequest(request) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path.startsWith('/api/')) {
        return _handleApiRequest(url.href, request)
    }

    if (request.method === 'POST' && path === '/_devix/query') {
        return handleQuery(request)
    }

    if (path.startsWith('/_devix/data/')) {
        return handleDataLoader(request, url)
    }

    if (path.startsWith('/_devix/actions/') && request.method === 'POST') {
        return _handleActionRequest(url.href, request)
    }

    return handleSsr(url, request)
}

async function handleQuery(request) {
    const t = Date.now()
    try {
        const registry = getQueryRegistry()
        const body = await decodeFromRequest(request)
        const results = {}
        const responseHeaders = new Headers()

        __setFrame({request, responseHeaders})
        try {
            await runWithQueryCache(async () => {
                for (const {name, args} of body || []) {
                    const fn = registry.get(name)
                    if (!fn) {
                        results[name] = {error: 'Query "' + name + '" not found'}
                        continue
                    }
                    results[name] = await fn(...(args || []))
                }
            }, undefined, request, responseHeaders)
        } finally {
            __setFrame(null)
        }

        const res = createTurboResponse(results)
        for (const [k, v] of responseHeaders.entries()) {
            res.headers.append(k, v)
        }
        return res
    } catch (e) {
        console.error('[devix] query RPC error:', e)
        return new Response(JSON.stringify({statusCode: 500, message: 'Internal Server Error'}), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        })
    }
}

async function handleDataLoader(request, url) {
    try {
        const data = await _runLoader(url.href, request, _glob)
        if (!data) {
            return new Response('Not Found', {status: 404})
        }
        if (data.error) {
            return new Response(JSON.stringify({statusCode: 500, message: 'Internal Server Error'}), {
                status: 500,
                headers: {'Content-Type': 'application/json'},
            })
        }
        if ('loaderError' in data) {
            const body = {statusCode: data.loaderError.statusCode, message: data.loaderError.message}
            return new Response(JSON.stringify(body), {
                status: body.statusCode,
                headers: {'Content-Type': 'application/json'},
            })
        }
        return createTurboResponse(data, request.signal)
    } catch (e) {
        console.error('[devix] data loader error:', e)
        return new Response(JSON.stringify({statusCode: 500, message: 'Internal Server Error'}), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        })
    }
}

function renderShell(lang, guardEncoded, getContent) {
    const assets = clientAssets
    const cssRefs = assets.css ?? []
    const clientEntry = assets.entry

    return renderToStream(() => (
        <NoHydration>
            {ssr('<!DOCTYPE html>')}
            <TopErrorBoundary>
            {RootLayout ? (
                <RootLayout
                    lang={lang}
                    assets={
                        <>
                            {cssRefs.map(function(css) { return <link rel="stylesheet" href={css.href || css} /> })}
                            {getAssets()}
                            <HydrationScript />
                        </>
                    }
                    scripts={
                        <>
                            {guardEncoded ? <script id="__DEVIX_GUARD__" type="text/turbo-stream">{guardEncoded}</script> : null}
                            <script type="module" src={clientEntry} />
                        </>
                    }
                >
                    <Hydration>
                        <ErrorBoundary>
                        <MetaProvider>
                            {getContent()}
                        </MetaProvider>
                        </ErrorBoundary>
                    </Hydration>
                </RootLayout>
            ) : (
                <html lang={lang}>
                    <head>
                        <meta charset="utf-8" />
                        {cssRefs.map(function(css) { return <link rel="stylesheet" href={css.href || css} /> })}
                        {getAssets()}
                        <HydrationScript />
                    </head>
                    <body>
                        {guardEncoded ? <script id="__DEVIX_GUARD__" type="text/turbo-stream">{guardEncoded}</script> : null}
                        <Hydration>
                            <ErrorBoundary>
                            <MetaProvider>
                                {getContent()}
                            </MetaProvider>
                            </ErrorBoundary>
                        </Hydration>
                        <script type="module" src={clientEntry} />
                    </body>
                </html>
            )}
            </TopErrorBoundary>
        </NoHydration>
    ))
}

function toWebStream(solidStream) {
    const {readable, writable} = new TransformStream()
    solidStream.pipeTo(writable)
    return readable
}

async function handleSsr(url, request) {
    const {pathname} = url
    const queryCache = new QueryCache()

    __setFrame({request, responseHeaders: new Headers()})

    let result
    try {
        result = await runWithQueryCache(
            () => resolvePageData(pathname, request, _glob),
            queryCache,
            request,
        )
    } catch (err) {
        __setFrame(null)
        console.error('[devix] render error:', err)
        const fallback = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body></body></html>'
        return new Response(fallback, {status: 500, headers: {'Content-Type': 'text/html'}})
    }

    if (!result) {
        const errBody = {statusCode: 404, message: 'Not found'}
        const errorContent = renderToString(() =>
            DefaultError({statusCode: errBody.statusCode, message: errBody.message}),
        )
        const stream = renderShell(
            'en',
            '',
            () => errorContent,
        )
        const readable = toWebStream(stream)
        return new Response(readable, {status: 404, headers: {'Content-Type': 'text/html'}})
    }

    if ('redirect' in result) {
        const {redirect, redirectStatus} = result
        return new Response(null, {
            status: redirectStatus,
            headers: {Location: redirect},
        })
    }

    if ('loaderError' in result) {
        const errBody = errorToBody(result.loaderError)
        const errorContent = renderToString(() =>
            DefaultError({statusCode: errBody.statusCode, message: errBody.message}),
        )
        const stream = renderShell(
            'en',
            '',
            () => errorContent,
        )
        const readable = toWebStream(stream)
        return new Response(readable, {
            status: errBody.statusCode,
            headers: {'Content-Type': 'text/html'},
        })
    }

    const {pageMod, layoutMods, params, guardData, lang} = result
    const guardEncoded = guardData !== undefined ? await collectEncode(guardData) : ''

    const stream = renderShell(lang, guardEncoded, () =>
        <App
            page={pageMod.default}
            layouts={layoutMods.map(function(m) { return m.default })}
            params={params}
            guardData={() => guardData}
        />
    )

    const readable = toWebStream(stream)

    return new Response(readable, {
        status: 200,
        headers: {'Content-Type': 'text/html'},
    })
}
`
}
