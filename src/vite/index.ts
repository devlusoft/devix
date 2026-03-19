import {UserConfig, Plugin, mergeConfig} from 'vite'
import type {DevixConfig} from '../config'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'
import {generateEntryClient} from './codegen/entry-client'
import {generateClientRoutes} from './codegen/client-routes'
import {generateRender} from './codegen/render'
import {generateApi} from './codegen/api'
import {invalidatePagesCache} from "../server/pages-router";
import {invalidateApiCache} from "../server/api-router";
import {generateContext} from "./codegen/context";
import {scanApiFiles} from "./codegen/scan-api";
import {generateRoutesDts} from "./codegen/routes-dts";
import {writeRoutesDts} from "./codegen/write-routes-dts";

const __dirname = dirname(fileURLToPath(import.meta.url))

const VIRTUAL_ENTRY_CLIENT = 'virtual:devix/entry-client'
const VIRTUAL_CLIENT_ROUTES = 'virtual:devix/client-routes'
const VIRTUAL_RENDER = 'virtual:devix/render'
const VIRTUAL_API = 'virtual:devix/api'
const VIRTUAL_CONTEXT = 'virtual:devix/context'

export function devix(config: DevixConfig): UserConfig {
    const appDir = config.appDir ?? 'app'
    const pagesDir = `${appDir}/pages`
    const cssUrls = (config.css ?? []).map(u => u.startsWith('/') ? u : `/${u.replace(/^\.\//, '')}`)

    const renderPath = resolve(__dirname, '../server/render.js').replace(/\\/g, '/')
    const apiPath = resolve(__dirname, '../server/api.js').replace(/\\/g, '/')
    const matcherPath = resolve(__dirname, '../runtime/client-router.js').replace(/\\/g, '/')

    const virtualPlugin: Plugin = {
        name: 'devix',
        enforce: 'pre',

        resolveId(id) {
            if (id === VIRTUAL_ENTRY_CLIENT) return `\0${VIRTUAL_ENTRY_CLIENT}`
            if (id === VIRTUAL_CLIENT_ROUTES) return `\0${VIRTUAL_CLIENT_ROUTES}`
            if (id === VIRTUAL_RENDER) return `\0${VIRTUAL_RENDER}`
            if (id === VIRTUAL_API) return `\0${VIRTUAL_API}`
            if (id === VIRTUAL_CONTEXT) return `\0${VIRTUAL_CONTEXT}`
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
        },

        buildStart() {
            const root = process.cwd()
            const entries = scanApiFiles(appDir, root)
            writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
        },

        configureServer(server) {
            const root = process.cwd()

            const regenerateDts = () => {
                const entries = scanApiFiles(appDir, root)
                writeRoutesDts(generateRoutesDts(entries, `${appDir}/api`), root)
            }

            server.watcher.on('add', (file) => {
                if (file.startsWith(resolve(root, pagesDir))) invalidatePagesCache()
                if (file.includes(`${appDir}/api`)) { invalidateApiCache(); regenerateDts() }
            })
            server.watcher.on('unlink', (file) => {
                if (file.startsWith(resolve(root, pagesDir))) invalidatePagesCache()
                if (file.includes(`${appDir}/api`)) { invalidateApiCache(); regenerateDts() }
            })
            server.watcher.on('change', (file) => {
                if (file.includes(`${appDir}/api`) && !file.endsWith('middleware.ts')) {
                    regenerateDts()
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