import {type UserConfig, type Plugin, type ViteDevServer, mergeConfig} from 'vite'
import {nitro} from "nitro/vite";
import type {DevixConfig} from '../config'
import solid from "vite-plugin-solid";
import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'
import {createRequire} from 'node:module'
import {mkdirSync, writeFileSync} from 'node:fs'
import {generateEntryClient} from './codegen/entry-client'
import {generateEntryServer} from './codegen/entry-server'
import {generateApi} from './codegen/api'
import {scanApiFiles} from "./codegen/scan-api";
import {generateRoutesDts} from "./codegen/routes-dts";
import {writeRoutesDts} from "./codegen/write-routes-dts";
import {devixLog} from "../utils/log"
import {generateServerDts, writeServerDts} from "./codegen/server-dts";
import {parseSync} from 'oxc-parser'
import {generateActions} from "./codegen/actions";
import {maybeTransformServerOnly} from "./codegen/transform-server-only";
import {collectCss} from "../server/collect-css";

const __dirname = dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

const VIRTUAL_ENTRY_CLIENT = 'virtual:devix/entry-client.jsx'
const VIRTUAL_ENTRY_SERVER = 'virtual:devix/entry-server'
const VIRTUAL_API = 'virtual:devix/api'
const VIRTUAL_ACTIONS = 'virtual:devix/actions'
const VIRTUAL_APP = 'virtual:devix/app'

const SERVER_EXPORTS = new Set(['guard', 'generateStaticParams', 'headers'])

function writeEntryServer(pagesDir: string, outPath: string, _require: NodeRequire) {
    const raw = generateEntryServer({pagesDir})
    const solidRequire = createRequire(_require.resolve('vite-plugin-solid'))
    const babel = solidRequire('@babel/core')
    const presetSolid = solidRequire('babel-preset-solid')
    const result = babel.transformSync(raw, {
        presets: [[presetSolid, {generate: 'ssr', hydratable: true}]],
        filename: 'entry-server.tsx',
        configFile: false,
        babelrc: false,
        sourceMaps: false,
    })
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, result.code)
}

let viteDevServer: ViteDevServer | null = null

export function devix(config: DevixConfig): UserConfig {
    const appDir = config.appDir ?? 'app'
    const pagesDir = `${appDir}/pages`
    const cssUrls = (config.css ?? []).map(u => u.startsWith('/') ? u : `/${u.replace(/^\.\//, '')}`)

    const apiPath = resolve(__dirname, '../server/api').replace(/\\/g, '/')
    const actionsPath = resolve(__dirname, '../server/actions').replace(/\\/g, '/')
    const entryServerPath = resolve(process.cwd(), '.devix', 'entry-server.js')
    const virtualPlugin: Plugin = {
        name: 'devix',
        enforce: 'pre',

        resolveId(id, _importer, _) {
            if (id === VIRTUAL_ENTRY_CLIENT) return `\0${VIRTUAL_ENTRY_CLIENT}`
            if (id === VIRTUAL_ENTRY_SERVER) return entryServerPath
            if (id === VIRTUAL_API) return `\0${VIRTUAL_API}`
            if (id === VIRTUAL_ACTIONS) return `\0${VIRTUAL_ACTIONS}`
            if (id === VIRTUAL_APP) return `\0${VIRTUAL_APP}`

            const ass = id.match(/^(.+)\?assets=(.+)$/)
            if (ass) {
                const base = ass[1]
                if (base === VIRTUAL_ENTRY_CLIENT) return `\0${id}`
            }
        },

        async load(id) {
            if (id === `\0${VIRTUAL_ENTRY_CLIENT}`)
                return generateEntryClient({cssUrls})
            if (id === `\0${VIRTUAL_API}`)
                return generateApi({apiPath, appDir})
            if (id === `\0${VIRTUAL_ACTIONS}`)
                return generateActions({actionsPath, appDir})
            if (id === `\0${VIRTUAL_ENTRY_CLIENT}?assets=client`) {
                if (viteDevServer) {
                    const cssFromServer = await collectCss(viteDevServer)
                    const allCss = [...cssUrls]
                    for (const u of cssFromServer) {
                        if (!allCss.includes(u)) allCss.push(u)
                    }
                    const virtualEntryUrl = '/@id/__x00__' + VIRTUAL_ENTRY_CLIENT
                    return `export default ${JSON.stringify({
                        entry: virtualEntryUrl,
                        css: allCss.map(function(u: string) { return {href: u} }),
                    })}`
                }
            }

            if (id === `\0${VIRTUAL_APP}`) {
                const result = [
'import {createComponent} from \'solid-js\'',
'',
'const _pages = import.meta.glob([\'/' + pagesDir + '/**/*.tsx\', \'!**/error.tsx\', \'!**/layout.tsx\'])',
'const _layouts = import.meta.glob(\'/' + pagesDir + '/**/layout.tsx\')',
'var _PAGES_DIR = \'/' + pagesDir + '\'',
'',
'function _fileToPattern(filePath) {',
'  var rel = \'/\' + filePath.slice(filePath.indexOf(\'/pages/\') + \'/pages/\'.length)',
'    .replace(/\\.(tsx|ts|jsx|js)$/, \'\')',
'    .replace(/\\(.*?\\)\\//g, \'\')',
'    .replace(/^index$|\\/index$/, \'\')',
'    .replace(/\\[([^\\]]+)\\]/g, \':$1\')',
'  return rel || \'/\'',
'}',
'',
'function _collectLayoutChain(pageFile, layoutFiles) {',
'  var parts = pageFile.split(\'/\')',
'  var chain = []',
'  var _pagesDirLen = _PAGES_DIR.split(\'/\').length',
'  for (var i = _pagesDirLen + 1; i <= parts.length - 1; i++) {',
'    var dir = parts.slice(0, i).join(\'/\')',
'    var lp = dir + \'/layout.tsx\'',
'    var lpts = dir + \'/layout.ts\'',
'    if (layoutFiles[lp]) chain.push(layoutFiles[lp])',
'    else if (layoutFiles[lpts]) chain.push(layoutFiles[lpts])',
'  }',
'  return chain',
'}',
'',
'var _routes = Object.keys(_pages).filter(function(f) {',
'  return !f.split(\'/\').pop().startsWith(\'layout\')',
'}).map(function(file) {',
'  var pattern = _fileToPattern(file)',
'  var paramNames = []',
'  var m; var re = /:([^/]+)/g',
'  while ((m = re.exec(pattern)) !== null) paramNames.push(m[1])',
'  return {pattern: pattern, params: paramNames, load: _pages[file], loadLayouts: _collectLayoutChain(file, _layouts)}',
'}).sort(function(a, b) {',
'  var aS = a.pattern.split(\'/\').filter(Boolean).length',
'  var bS = b.pattern.split(\'/\').filter(Boolean).length',
'  for (var i = 0; i < Math.max(aS, bS); i++) {',
'    var aSegs = a.pattern.split(\'/\').filter(Boolean)',
'    var bSegs = b.pattern.split(\'/\').filter(Boolean)',
'    var aV = i < aS ? (aSegs[i].startsWith(\':\') ? 1 : 2) : 0',
'    var bV = i < bS ? (bSegs[i].startsWith(\':\') ? 1 : 2) : 0',
'    if (aV !== bV) return bV - aV',
'  }',
'  return b.pattern.length - a.pattern.length',
'})',
'',
'export function resolveRoute(pathname) {',
'  for (var i = 0; i < _routes.length; i++) {',
'    var route = _routes[i]',
'    var re = new RegExp(\'^\' + route.pattern.replace(/:[^/]+/g, \'([^/]+)\').replace(/\\//g, \'\\\\/\') + \'$\')',
'    var m = pathname.match(re)',
'    if (m) {',
'      var params = {}',
'      for (var j = 0; j < route.params.length; j++) params[route.params[j]] = decodeURIComponent(m[j + 1])',
'      return {load: route.load, loadLayouts: route.loadLayouts, params: params}',
'    }',
'  }',
'  return null',
'}',
'',
'function LayoutStack(props) {',
'  var idx = props.index || 0',
'  if (idx < props.layouts.length) {',
'    var L = props.layouts[idx]',
'    return createComponent(L, {',
'      params: props.params,',
'      guardData: props.guardData,',
'      children: createComponent(LayoutStack, { ...props, index: idx + 1 }),',
'    })',
'  }',
'  return createComponent(props.page, {',
'    params: props.params,',
'    guardData: props.guardData,',
'  })',
'}',
'',
'export default function App(props) {',
'  return createComponent(LayoutStack, props)',
'}',
]
                return result.join('\n')
            }
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
            writeEntryServer(pagesDir, entryServerPath, _require)
            const root = process.cwd()
            const entries = scanApiFiles(appDir, root)
            writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            writeServerDts(generateServerDts(config.server), root)
        },

        configureServer(server) {
            viteDevServer = server
            const root = process.cwd()
            const rootLayoutPath = resolve(root, pagesDir, 'layout.tsx')

            const regenerateDts = () => {
                const entries = scanApiFiles(appDir, root)
                writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            }

            const invalidateVirtualModule = (id: string) => {
                const mod = server.moduleGraph.getModuleById(`\0${id}`)
                if (mod) server.moduleGraph.invalidateModule(mod)
            }

            const invalidateModuleByPath = (filePath: string) => {
                const mod = server.moduleGraph.getModuleById(filePath)
                if (mod) server.moduleGraph.invalidateModule(mod)
            }

            server.watcher.add(resolve(root, 'devix.config.ts'))
            server.watcher.on('change', (file) => {
                if (file === resolve(root, 'devix.config.ts')) {
                    devixLog.info('Config changed, restarting...')
                    process.exit(75)
                }
                if (file === rootLayoutPath) {
                    writeEntryServer(pagesDir, entryServerPath, _require)
                    invalidateModuleByPath(entryServerPath)
                    devixLog.info('Root layout changed, entry-server regenerated')
                }
            })

            server.watcher.on('add', (file) => {
                if (file.includes(`${appDir}/api`)) {
                    invalidateVirtualModule(VIRTUAL_API)
                    regenerateDts()
                }
                if (file.includes(`${appDir}/actions`)) {
                    invalidateVirtualModule(VIRTUAL_ACTIONS)
                }
            })
            server.watcher.on('unlink', (file) => {
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
        plugins: [solid({ssr: true, hot: false}), virtualPlugin, nitro()],
        esbuild: {jsx: 'preserve', jsxImportSource: 'solid-js'},
        publicDir: resolve(process.cwd(), config.publicDir ?? 'public'),
        ssr: {noExternal: ['@devlusoft/devix', 'solid-js', 'solid-js/web', 'seroval', 'seroval-plugins']},
        environments: {
            ssr: {
                build: {rollupOptions: {input: entryServerPath}},
            },
            client: {
                build: {rollupOptions: {input: 'virtual:devix/entry-client.jsx'}},
            },
        },
        ...(config.envPrefix ? {envPrefix: config.envPrefix} : {}),
    }

    return mergeConfig(base, config.vite ?? {})
}