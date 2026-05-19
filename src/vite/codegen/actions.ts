interface ActionsOptions {
    actionsPath: string
    appDir: string
}

export function generateActions({actionsPath, appDir}: ActionsOptions): string {
    return `
import { handleActionRequest as _handleActionRequest } from '${actionsPath}'

const _actions = import.meta.glob('/${appDir}/actions/**/*.ts')

const _glob = {
    actions: _actions,
}

export function handleActionRequest(url, request) {
    return _handleActionRequest(url, request, _glob)
}
`
}
