interface ApiOptions {
    apiPath: string
    appDir: string
}

export function generateApi({apiPath, appDir}: ApiOptions): string {
    return `
import { handleApiRequest as _handleApiRequest } from '${apiPath}'

const _routes = import.meta.glob(['/${appDir}/api/**/*.ts', '!**/middleware.ts'])
const _middlewares = import.meta.glob('/${appDir}/api/**/middleware.ts')

const _glob = {
    routes: _routes,
    middlewares: _middlewares,
    apiDir: '/${appDir}/api',
}

export function handleApiRequest(url, request) {
    return _handleApiRequest(url, request, _glob)
}
`
}
