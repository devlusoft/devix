import {UserConfig, Plugin, mergeConfig} from 'vite'
import type {DevixConfig} from '../config'
import solid from "vite-plugin-solid";
import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'
import {createRequire} from 'node:module'
import {generateEntryClient} from './codegen/entry-client'
import {generateClientRoutes} from './codegen/client-routes'
import {generateRender} from './codegen/render'
import {generateApi} from './codegen/api'
import {generateServerEntry} from './codegen/server-entry'
import {scanApiFiles} from "./codegen/scan-api";
import {generateRoutesDts} from "./codegen/routes-dts";
import {writeRoutesDts} from "./codegen/write-routes-dts";
import {devixLog} from "../utils/log"
import {generateServerDts, writeServerDts} from "./codegen/server-dts";
import {parseSync} from 'oxc-parser'
import {generateActions} from "./codegen/actions";
import {maybeTransformServerOnly} from "./codegen/transform-server-only";

const __dirname = dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

const VIRTUAL_ENTRY_CLIENT = 'virtual:devix/entry-client.jsx'
const VIRTUAL_CLIENT_ROUTES = 'virtual:devix/client-routes.jsx'
const VIRTUAL_RENDER = 'virtual:devix/render'
const VIRTUAL_API = 'virtual:devix/api'
const VIRTUAL_CONTEXT = 'virtual:devix/context'
const VIRTUAL_SERVER_ENTRY = 'virtual:devix/server-entry'
const VIRTUAL_ACTIONS = 'virtual:devix/actions'

const SERVER_EXPORTS = new Set(['guard', 'generateStaticParams', 'headers'])

export function devix(config: DevixConfig): UserConfig {
    const appDir = config.appDir ?? 'app'
    const pagesDir = `${appDir}/pages`
    const cssUrls = (config.css ?? []).map(u => u.startsWith('/') ? u : `/${u.replace(/^\.\//, '')}`)

    const renderPath = resolve(__dirname, '../server/render').replace(/\\/g, '/')
    const apiPath = resolve(__dirname, '../server/api').replace(/\\/g, '/')
    const actionsPath = resolve(__dirname, '../server/actions').replace(/\\/g, '/')
    const matcherPath = resolve(__dirname, '../runtime/client-router.js').replace(/\\/g, '/')
    

    const virtualPlugin: Plugin = {
        name: 'devix',
        enforce: 'pre',

        resolveId(id, _importer, _) {
            if (id === VIRTUAL_ENTRY_CLIENT) return `\0${VIRTUAL_ENTRY_CLIENT}`
            if (id === VIRTUAL_CLIENT_ROUTES) return `\0${VIRTUAL_CLIENT_ROUTES}`
            if (id === VIRTUAL_RENDER) return `\0${VIRTUAL_RENDER}`
            if (id === VIRTUAL_API) return `\0${VIRTUAL_API}`
            if (id === VIRTUAL_CONTEXT) return `\0${VIRTUAL_CONTEXT}`
            if (id === VIRTUAL_SERVER_ENTRY) return `\0${VIRTUAL_SERVER_ENTRY}`
            if (id === VIRTUAL_ACTIONS) return `\0${VIRTUAL_ACTIONS}`
            if (id === '@hono/node-server' || id === '@hono/node-server/serve-static' || id === 'hono') {
                try {
                    return _require.resolve(id)
                } catch { /* fall through */ }
            }
        },

        load(id) {
            if (id === `\0${VIRTUAL_ENTRY_CLIENT}`)
                return generateEntryClient({cssUrls})
            if (id === `\0${VIRTUAL_CLIENT_ROUTES}`)
                return generateClientRoutes({pagesDir, matcherPath})
            if (id === `\0${VIRTUAL_RENDER}`)
                return generateRender({pagesDir, renderPath})
            if (id === `\0${VIRTUAL_API}`)
                return generateApi({apiPath, appDir})
            if (id === `\0${VIRTUAL_SERVER_ENTRY}`)
                return generateServerEntry({
                    routesPath: resolve(__dirname, '../server/routes').replace(/\\/g, '/'),
                    envPath: resolve(__dirname, '../utils/env').replace(/\\/g, '/'),
                    honoServerPath: '@hono/node-server',
                    honoServerStaticPath: '@hono/node-server/serve-static',
                    honoPath: 'hono',
                })
            if (id === `\0${VIRTUAL_ACTIONS}`)
                return generateActions({actionsPath, appDir})
        },


        transform(code, id, options) {
            if (options?.ssr) return

            const resolvedPagesDir = resolve(process.cwd(), pagesDir)
            let pageCode = code
            let pageChanged = false

            if (id.startsWith(resolvedPagesDir)) {
                const ast = parseSync(id, code, {sourceType: 'module'})

                const replacements: { start: number; end: number; replacement: string }[] = []

                for (const node of ast.program.body) {
                    if (node.type !== 'ExportNamedDeclaration') continue

                    if (!node.declaration && node.specifiers) {
                        const matchingSpecs: { spec: any; idx: number }[] = []
                        for (let i = 0; i < node.specifiers.length; i++) {
                            const spec = node.specifiers[i]
                            if (spec.exported.type === 'Identifier' && (SERVER_EXPORTS.has(spec.exported.name) || (spec.local.type === 'Identifier' && SERVER_EXPORTS.has(spec.local.name)))) {
                                matchingSpecs.push({spec, idx: i})
                            }
                        }

                        if (matchingSpecs.length > 0) {
                            if (matchingSpecs.length === node.specifiers.length) {
                                replacements.push({start: node.start, end: node.end, replacement: ''})
                            } else {
                                for (const {spec} of matchingSpecs) {
                                    const after = code.slice(spec.end)
                                    const comma = after.match(/^\s*,/)
                                    const end = comma ? spec.end + comma[0].length : spec.end
                                    replacements.push({start: spec.start, end, replacement: ''})
                                }
                            }
                        }
                        continue
                    }

                    const decl = node.declaration!

                    if (decl.type === 'FunctionDeclaration' && decl.id && SERVER_EXPORTS.has(decl.id.name)) {
                        replacements.push({start: node.start, end: node.end, replacement: `export const ${decl.id.name} = undefined`})
                        continue
                    }

                    if (decl.type === 'VariableDeclaration') {
                        for (const declarator of decl.declarations) {
                            if (declarator.id.type === 'Identifier' && SERVER_EXPORTS.has(declarator.id.name)) {
                                if (declarator.init) {
                                    replacements.push({start: declarator.init.start, end: declarator.init.end, replacement: 'undefined'})
                                }
                            }
                            if (declarator.id.type === 'ObjectPattern') {
                                let found = false
                                for (const prop of declarator.id.properties) {
                                    if (prop.type === 'Property' && prop.key.type === 'Identifier' && SERVER_EXPORTS.has(prop.key.name)) {
                                        found = true
                                        const after = code.slice(prop.end)
                                        const comma = after.match(/^\s*,/)
                                        const end = comma ? prop.end + comma[0].length : prop.end
                                        replacements.push({start: prop.start, end, replacement: ''})
                                    }
                                }
                                if (found && declarator.init) {
                                    replacements.push({start: declarator.init.start, end: declarator.init.end, replacement: 'undefined'})
                                }
                            }
                        }
                    }
                }

                if (replacements.length > 0) {
                    replacements.sort((a, b) => b.start - a.start)
                    for (const {start, end, replacement} of replacements) {
                        pageCode = pageCode.slice(0, start) + replacement + pageCode.slice(end)
                    }
                    pageChanged = true
                }
            }

            const qaResult = maybeTransformServerOnly(pageChanged ? pageCode : code, id, appDir)
            if (qaResult) return qaResult
            if (pageChanged) return {code: pageCode, map: null}
        },

        buildStart() {
            const root = process.cwd()
            const entries = scanApiFiles(appDir, root)
            writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            writeServerDts(generateServerDts(config.server), root)
        },

        configureServer(server) {
            const root = process.cwd()

            const regenerateDts = () => {
                const entries = scanApiFiles(appDir, root)
                writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            }

            const invalidateVirtualModule = (id: string) => {
                const mod = server.moduleGraph.getModuleById(`\0${id}`)
                if (mod) server.moduleGraph.invalidateModule(mod)
            }

            server.watcher.add(resolve(root, 'devix.config.ts'))
            server.watcher.on('change', (file) => {
                if (file === resolve(root, 'devix.config.ts')) {
                    devixLog.info('Config changed, restarting...')
                    process.exit(75)
                }
            })

            server.watcher.on('add', (file) => {
                if (file.startsWith(resolve(root, pagesDir))) invalidateVirtualModule(VIRTUAL_RENDER)
                if (file.includes(`${appDir}/api`)) {
                    invalidateVirtualModule(VIRTUAL_API)
                    regenerateDts()
                }
                if (file.includes(`${appDir}/actions`)) {
                    invalidateVirtualModule(VIRTUAL_ACTIONS)
                }
            })
            server.watcher.on('unlink', (file) => {
                if (file.startsWith(resolve(root, pagesDir))) invalidateVirtualModule(VIRTUAL_RENDER)
                if (file.includes(`${appDir}/api`)) {
                    invalidateVirtualModule(VIRTUAL_API)
                    regenerateDts()
                }
                if (file.includes(`${appDir}/actions`)) {
                    invalidateVirtualModule(VIRTUAL_ACTIONS)
                }
            })
        },
    }

    const base: UserConfig = {
        plugins: [solid({ssr: true, hot: false}), virtualPlugin],
        publicDir: resolve(process.cwd(), config.publicDir ?? 'public'),
        ssr: {noExternal: ['@devlusoft/devix', 'solid-js', 'solid-js/web', 'seroval', 'seroval-plugins']},
        ...(config.envPrefix ? {envPrefix: config.envPrefix} : {}),
    }

    return mergeConfig(base, config.vite ?? {})
}