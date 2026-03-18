export function routePattern(rel: string): string {
    return rel
            .replace(/\.(tsx|ts|jsx|js)$/, '')
            .replace(/\(.*?\)\//g, '')
            .replace(/^index$|\/index$/, '')
            .replace(/\[([^\]]+)]/g, ':$1')
        || '/'
}