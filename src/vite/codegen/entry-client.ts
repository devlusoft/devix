interface EntryClientOptions {
    cssUrls: string[]
}

export function generateEntryClient({ cssUrls }: EntryClientOptions): string {
    const cssImports = cssUrls.map(u => `import '${u}'`).join('\n')

    return `
${cssImports}
import {matchClientRoute, loadErrorPage, getDefaultErrorPage} from 'virtual:devix/client-routes.jsx'
import {bootstrap} from '@devlusoft/devix/client/browser'

bootstrap({matchClientRoute, loadErrorPage, getDefaultErrorPage})
`
}
