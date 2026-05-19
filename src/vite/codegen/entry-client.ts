interface EntryClientOptions {
    cssUrls: string[]
}

export function generateEntryClient({ cssUrls }: EntryClientOptions): string {
    const cssImports = cssUrls.map(u => `import '${u}'`).join('\n')

    return `
${cssImports}
import "@vitejs/plugin-react/preamble"
import React from "react"
import {hydrateRoot, createRoot} from 'react-dom/client'
import {matchClientRoute, loadErrorPage, getDefaultErrorPage} from 'virtual:devix/client-routes'
import {RouterProvider, decodeTurbo, decodeResponse} from '@devlusoft/devix'

const root = document.getElementById('devix-root')

if (!window.__DEVIX__) {
    const ErrorPage = getDefaultErrorPage()
    createRoot(root).render(React.createElement(ErrorPage, {statusCode: 500, message: 'Server error'}))
} else {
    const {metadata, viewport, clientEntry} = window.__DEVIX__
    let loaderData, layoutsData = [], guardData = null

    if (window.__DEVIX_TURBO__) {
        const value = await decodeTurbo(new ReadableStream({
            start(controller) {
                controller.enqueue(atob(window.__DEVIX_TURBO__))
                controller.close()
            }
        }))
        loaderData = value.LOADER_DATA
        layoutsData = value.LAYOUTS_DATA ?? []
        guardData = value.GUARD_DATA ?? null
    }

    const deferredKeys = window.__DEVIX_DEFERRED__ ?? []
    const deferredResolvers = {}
    const deferredPromises = {}
    for (const key of deferredKeys) {
        deferredPromises[key] = new Promise(r => { deferredResolvers[key] = r })
    }

    if (loaderData && typeof loaderData === 'object' && deferredKeys.length > 0) {
        loaderData = Object.assign({}, loaderData, deferredPromises)
    }

    const matched = matchClientRoute(window.location.pathname)

    if (window.__LOADER_ERROR__) {
        const {statusCode, message, code, data} = window.__LOADER_ERROR__
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        createRoot(root).render(
            React.createElement(RouterProvider, {
                matchClientRoute,
                loadErrorPage,
                getDefaultErrorPage,
                clientEntry,
                initialData: null,
                initialParams: {},
                initialPage: () => null,
                initialError: {statusCode, message, code, data},
                initialErrorPage: ErrorPage,
            })
        )
    } else if (matched) {
        const [pageMod, ...layoutMods] = await Promise.all([
            matched.load(),
            ...matched.loadLayouts.map(l => l()),
        ])
        hydrateRoot(
            root,
            React.createElement(RouterProvider, {
                matchClientRoute,
                loadErrorPage,
                getDefaultErrorPage,
                clientEntry,
                initialData: loaderData,
                initialParams: matched.params,
                initialPage: pageMod.default,
                initialLayouts: layoutMods.map(m => m.default),
                initialLayoutsData: layoutsData,
                initialGuardData: guardData,
                initialMeta: metadata,
                initialViewport: viewport,
            })
        )

        if (deferredKeys.length > 0) {
            fetch('/_devix/data' + window.location.pathname)
                .then(async res => {
                    if (!res.ok) return
                    const data = await decodeResponse(res)
                    for (const key of deferredKeys) {
                        if (key in data.loaderData) {
                            const value = await data.loaderData[key]
                            deferredResolvers[key](value)
                        }
                    }
                })
                .catch(() => {})
        }

        if (window.location.hash) {                                                                                 
            const id = window.location.hash.slice(1)                                                                
            const scrollBehavior = getComputedStyle(document.documentElement).scrollBehavior                        
            requestAnimationFrame(() => {                                                   
                document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior })                           
            })                                                                           
        }    
    } else {
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        createRoot(root).render(
            React.createElement(RouterProvider, {
                matchClientRoute,
                loadErrorPage,
                getDefaultErrorPage,
                clientEntry,
                initialData: null,
                initialParams: {},
                initialPage: () => null,
                initialLayouts: [],
                initialLayoutsData: [],
                initialMeta: null,
                initialError: {statusCode: 404, message: 'Not found'},
                initialErrorPage: ErrorPage,
            })
        )
    }
}
`
}