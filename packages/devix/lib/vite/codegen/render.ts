interface RenderOptions {
    pagesDir: string
    renderPath: string
}

export function generateRender({pagesDir, renderPath}: RenderOptions): string {
    return `
import { render as _render, getStaticRoutes as _getStaticRoutes, renderStream as _renderStream, renderData as _renderData } from '${renderPath}'

const _pages = import.meta.glob(['/${pagesDir}/**/*.tsx', '!**/error.tsx', '!**/layout.tsx'])
const _layouts = import.meta.glob('/${pagesDir}/**/layout.tsx')

const _glob = {
    pages: _pages,
    layouts: _layouts,
    pagesDir: '/${pagesDir}',
}

export function render(url, request, options) {
    return _render(url, request, _glob, options)
}

export function renderStream(url, request, options) {
    return _renderStream(url, request, _glob, options)
}

export function renderData(url, request, options) {
    return _renderData(url, request, _glob, options)
}

export function getStaticRoutes() {
    return _getStaticRoutes(_glob)
}
`
}