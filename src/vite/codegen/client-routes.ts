interface ClientRoutesOptions {
    pagesDir: string
    matcherPath: string
}

export function generateClientRoutes({pagesDir, matcherPath}: ClientRoutesOptions) {
    return `
import { createMatcher } from '${matcherPath}'
import DefaultError from '@devlusoft/devix/client/default-error'

const pageFiles = import.meta.glob(['/${pagesDir}/**/*.tsx', '!**/error.tsx', '!**/layout.tsx'])
const layoutFiles = import.meta.glob('/${pagesDir}/**/layout.tsx')
const errorFiles = import.meta.glob('/${pagesDir}/**/error.tsx')

export const matchClientRoute = createMatcher(pageFiles, layoutFiles)

export async function loadErrorPage() {
    const key = Object.keys(errorFiles)[0]
    if (!key) return null
    const mod = await errorFiles[key]()
    return mod?.default ?? null
}

export function getDefaultErrorPage() {
    return DefaultError
}
`
}