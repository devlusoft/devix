interface EntryClientOptions {
    cssUrls: string[]
}

export function generateEntryClient({ cssUrls }: EntryClientOptions): string {
    const cssImports = cssUrls.map(u => `import '${u}'`).join('\n')

    return `
${cssImports}
import {hydrate} from 'solid-js/web'
import {createComponent, ErrorBoundary} from 'solid-js'
import {MetaProvider} from '@devlusoft/devix'
import App, {resolveRoute} from 'virtual:devix/app'

function Dummy(props) { return props.children; }

const _route = resolveRoute(window.location.pathname)
if (_route) {
    const _pageMod = await _route.load()
    const _layoutMods = await Promise.all(_route.loadLayouts.map(function(l) { return l() }))
    hydrate(function() {
        return createComponent(Dummy, {get children() {
            return createComponent(Dummy, {get children() {
                return createComponent(ErrorBoundary, {get children() {
                    return createComponent(MetaProvider, {get children() {
                        return createComponent(App, {
                            page: _pageMod.default,
                            layouts: _layoutMods.map(function(m) { return m.default }),
                            params: _route.params,
                        })
                    }})
                }})
            }})
        }})
    }, document)
}
`
}
