interface EntryClientOptions {
    cssUrls: string[]
}

export function generateEntryClient({cssUrls}: EntryClientOptions): string {
    const cssImports = cssUrls.map(u => `import '${u}'`).join('\n')

    return `
${cssImports}
import "@vitejs/plugin-react/preamble"
import React from "react"
import {hydrateRoot, createRoot} from 'react-dom/client'
import {matchClientRoute, loadErrorPage, getDefaultErrorPage} from 'virtual:devix/client-routes'
import {RouterProvider} from '@devlusoft/devix'

const root = document.getElementById('devix-root')

if (!window.__DEVIX__) {
    const ErrorPage = getDefaultErrorPage()
    createRoot(root).render(React.createElement(ErrorPage, {statusCode: 500, message: 'Server error'}))
} else {
    const {metadata, viewport, clientEntry} = window.__DEVIX__
    const loaderData = window.__LOADER_DATA__
    const layoutsData = window.__LAYOUTS_DATA__ ?? []

    const matched = matchClientRoute(window.location.pathname)

    if (matched) {
        const [pageMod, ...layoutMods] = await Promise.all([
            matched.load(),
            ...matched.loadLayouts.map(l => l()),
        ])
        hydrateRoot(
            root,
            React.createElement(RouterProvider, {
                clientEntry,
                initialData: loaderData,
                initialParams: matched.params,
                initialPage: pageMod.default,
                initialLayouts: layoutMods.map(m => m.default),
                initialLayoutsData: layoutsData,
                initialMeta: metadata,
                initialViewport: viewport,
            })
        )
    } else {
        const ErrorPage = await loadErrorPage() ?? getDefaultErrorPage()
        createRoot(root).render(
            React.createElement(RouterProvider, {
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