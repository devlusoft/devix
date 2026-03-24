import {readFileSync, mkdirSync, writeFileSync, rmSync} from 'node:fs'
import {resolve, join} from 'node:path'
import type {Manifest} from 'vite'
import { pathToFileURL } from "node:url"
import {loadConfig} from "../utils/load-config";

const userConfig = await loadConfig(process.cwd())
if (userConfig.output !== 'static') {
    console.warn('[devix] Tip: set output: "static" in devix.config.ts to skip the SSR server at runtime.')
}

await import('./build.js')

const t = Date.now()
const renderModule = await import(pathToFileURL(resolve(process.cwd(), 'dist/server/render.js')).href + `?t=${t}`)

const manifest: Manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), 'dist/client/.vite/manifest.json'), 'utf-8')
)

const urls: string[] = await renderModule.getStaticRoutes()

console.log(`[devix] Generating ${urls.length} static page${urls.length === 1 ? '' : 's'}...`)

for (const url of urls) {
    const fullUrl = `http://localhost${url}`
    const {html, statusCode} = await renderModule.render(fullUrl, new Request(fullUrl), {manifest})

    if (statusCode !== 200) {
        console.warn(`[devix] Skipping ${url} — status ${statusCode}`)
        continue
    }

    const outPath = url === '/'
        ? join(process.cwd(), 'dist/client/index.html')
        : join(process.cwd(), 'dist/client', url, 'index.html')

    mkdirSync(join(outPath, '..'), {recursive: true})
    writeFileSync(outPath, `<!DOCTYPE html>${html}`, 'utf-8')

    const data = await renderModule.runLoader(fullUrl, new Request(fullUrl), {manifest})
    const dataPath = url === '/'
        ? join(process.cwd(), 'dist/client/_data/index.json')
        : join(process.cwd(), 'dist/client/_data', `${url}.json`)
    
    mkdirSync(join(dataPath, '..'), {recursive: true})
    writeFileSync(dataPath, JSON.stringify(data), 'utf-8')

    console.log(`  ✓ ${url}`)
}

console.log('[devix] Generation complete.')

if (userConfig.output === 'static') {
    rmSync(resolve(process.cwd(), 'dist/server'), { recursive: true, force: true })
    console.log('[devix] Removed dist/server (not needed in static mode)')
}

export {}
