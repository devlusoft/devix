interface RenderOptions {
    pagesDir: string
    renderPath: string
}

export function generateRender({pagesDir, renderPath}: RenderOptions): string {
    return `
import { render as _render, runLoader as _runLoader, getStaticRoutes as _getStaticRoutes } from '${renderPath}'

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

export function runLoader(url, request, options) {
    return _runLoader(url, request, _glob, options)
}

export function getStaticRoutes() {
    return _getStaticRoutes(_glob)
}
`
}
