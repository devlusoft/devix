import {UserConfig, Plugin, mergeConfig} from 'vite'
import type {DevixConfig} from '../config'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {dirname, relative, resolve} from 'node:path'
import {createRequire} from 'node:module'
import {generateEntryClient} from './codegen/entry-client'
import {generateClientRoutes} from './codegen/client-routes'
import {generateRender} from './codegen/render'
import {generateApi} from './codegen/api'
import {generateContext} from "./codegen/context";
import {scanApiFiles} from "./codegen/scan-api";
import {generateRoutesDts} from "./codegen/routes-dts";
import {writeRoutesDts} from "./codegen/write-routes-dts";
import {parseSync} from 'oxc-parser'
import {generateServerEntry} from "./codegen/server-entry";
import {deletePageTypes, scanAndWritePageTypes, writePageTypes} from "./codegen/page-types";
import {generateServerDts, writeServerDts} from "./codegen/server-dts";
import {scanActions} from "./codegen/scan-actions";
import {generateActionsDts} from "./codegen/actions-dts";
import {writeActionsDts} from "./codegen/write-actions-dts";
import {generateActions} from "./codegen/actions";

const __dirname = dirname(fileURLToPath(import.meta.url))

const VIRTUAL_ENTRY_CLIENT = 'virtual:devix/entry-client'
const VIRTUAL_CLIENT_ROUTES = 'virtual:devix/client-routes'
const VIRTUAL_RENDER = 'virtual:devix/render'
const VIRTUAL_API = 'virtual:devix/api'
const VIRTUAL_CONTEXT = 'virtual:devix/context'
const VIRTUAL_SERVER_ENTRY = 'virtual:devix/server-entry'
const VIRTUAL_ACTIONS = 'virtual:devix/actions'

const SERVER_EXPORTS = new Set(['loader', 'guard', 'generateStaticParams', 'headers'])

export function devix(config: DevixConfig): UserConfig {
    const appDir = config.appDir ?? 'app'
    const pagesDir = `${appDir}/pages`
    const cssUrls = (config.css ?? []).map(u => u.startsWith('/') ? u : `/${u.replace(/^\.\//, '')}`)

    const renderPath = resolve(__dirname, '../server/render.js').replace(/\\/g, '/')
    const apiPath = resolve(__dirname, '../server/api.js').replace(/\\/g, '/')
    const actionsPath = resolve(__dirname, '../server/actions.js').replace(/\\/g, '/')
    const matcherPath = resolve(__dirname, '../runtime/client-router.js').replace(/\\/g, '/')
    const routesPath = resolve(__dirname, '../server/routes.js').replace(/\\/g, '/')
    const envPath = resolve(__dirname, '../utils/env.js').replace(/\\/g, '/')

    const _require = createRequire(import.meta.url)
    const honoServerPath = _require.resolve('@hono/node-server').replace(/\\/g, '/')
    const honoServerStaticPath = _require.resolve('@hono/node-server/serve-static').replace(/\\/g, '/')
    const honoPath = _require.resolve('hono').replace(/\\/g, '/')

    const virtualPlugin: Plugin = {
        name: 'devix',
        enforce: 'pre',

        resolveId(id) {
            if (id === VIRTUAL_ENTRY_CLIENT) return `\0${VIRTUAL_ENTRY_CLIENT}`
            if (id === VIRTUAL_CLIENT_ROUTES) return `\0${VIRTUAL_CLIENT_ROUTES}`
            if (id === VIRTUAL_RENDER) return `\0${VIRTUAL_RENDER}`
            if (id === VIRTUAL_API) return `\0${VIRTUAL_API}`
            if (id === VIRTUAL_CONTEXT) return `\0${VIRTUAL_CONTEXT}`
            if (id === VIRTUAL_SERVER_ENTRY) return `\0${VIRTUAL_SERVER_ENTRY}`
            if (id === VIRTUAL_ACTIONS) return `\0${VIRTUAL_ACTIONS}`
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
            if (id === `\0${VIRTUAL_CONTEXT}`)
                return generateContext()
            if (id === `\0${VIRTUAL_SERVER_ENTRY}`)
                return generateServerEntry({routesPath, envPath, honoServerPath, honoServerStaticPath, honoPath})
            if (id === `\0${VIRTUAL_ACTIONS}`)
                return generateActions({actionsPath, appDir})
        },


        transform(code, id, options) {
            if (options?.ssr) return

            const resolvedPagesDir = resolve(process.cwd(), pagesDir)
            if (!id.startsWith(resolvedPagesDir)) return

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

            if (replacements.length === 0) return

            replacements.sort((a, b) => b.start - a.start)

            let result = code
            for (const {start, end, replacement} of replacements) {
                result = result.slice(0, start) + replacement + result.slice(end)
            }

            return {code: result, map: null}
        },

        buildStart() {
            const root = process.cwd()
            const entries = scanApiFiles(appDir, root)
            writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            writeServerDts(generateServerDts(config.server), root)
            const actionEntries = scanActions(appDir, root)
            writeActionsDts(generateActionsDts(actionEntries, appDir), root)
            const {warnings} = scanAndWritePageTypes(appDir, root)
            for (const w of warnings) console.warn(w)
        },

        configureServer(server) {
            const root = process.cwd()

            const initial = scanAndWritePageTypes(appDir, root)
            for (const w of initial.warnings) console.warn(w)

            const regenerateDts = () => {
                const entries = scanApiFiles(appDir, root)
                writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            }

            const regenerateActionsDts = () => {
                const actionEntries = scanActions(appDir, root)
                writeActionsDts(generateActionsDts(actionEntries, appDir), root)
            }

            const isPageFile = (file: string) => file.startsWith(resolve(root, pagesDir)) && !file.endsWith('layout.tsx') && !file.endsWith('error.tsx')

            const pageRelPath = (file: string) => relative(root, file).replace(/\\/g, '/')

            const invalidateVirtualModule = (id: string) => {
                const mod = server.moduleGraph.getModuleById(`\0${id}`)
                if (mod) server.moduleGraph.invalidateModule(mod)
            }

            server.watcher.add(resolve(root, 'devix.config.ts'))
            server.watcher.on('change', (file) => {
                if (file === resolve(root, 'devix.config.ts')) {
                    console.log('[devix] Config changed, restarting...')
                    process.exit(75)
                }
            })

            const writePageTypesAndLog = (file: string) => {
                try {
                    const {warnings} = writePageTypes(pageRelPath(file), root)
                    for (const w of warnings) console.warn(w)
                } catch {
                    /* ignorar archivos no procesables */
                }
            }

            server.watcher.on('add', (file) => {
                if (file.startsWith(resolve(root, pagesDir))) invalidateVirtualModule(VIRTUAL_RENDER)
                if (isPageFile(file)) writePageTypesAndLog(file)
                if (file.includes(`${appDir}/api`)) {
                    invalidateVirtualModule(VIRTUAL_API)
                    regenerateDts()
                }
                if (file.includes(`${appDir}/actions`)) {
                    invalidateVirtualModule(VIRTUAL_ACTIONS)
                    regenerateActionsDts()
                }
            })
            server.watcher.on('unlink', (file) => {
                if (file.startsWith(resolve(root, pagesDir))) invalidateVirtualModule(VIRTUAL_RENDER)
                if (isPageFile(file)) deletePageTypes(pageRelPath(file), root)
                if (file.includes(`${appDir}/api`)) {
                    invalidateVirtualModule(VIRTUAL_API)
                    regenerateDts()
                }
                if (file.includes(`${appDir}/actions`)) {
                    invalidateVirtualModule(VIRTUAL_ACTIONS)
                    regenerateActionsDts()
                }
            })
            server.watcher.on('change', (file) => {
                if (isPageFile(file)) writePageTypesAndLog(file)
                if (file.includes(`${appDir}/api`) && !file.endsWith('middleware.ts')) {
                    regenerateDts()
                }
                if (file.includes(`${appDir}/actions`)) {
                    regenerateActionsDts()
                }
            })
        },
    }

    const base: UserConfig = {
        plugins: [react(), virtualPlugin],
        publicDir: resolve(process.cwd(), config.publicDir ?? 'public'),
        ssr: {noExternal: ['@devlusoft/devix']},
        ...(config.envPrefix ? {envPrefix: config.envPrefix} : {}),
    }

    return mergeConfig(base, config.vite ?? {})
}