import {readFileSync, mkdirSync, writeFileSync, rmSync} from 'node:fs'
import {resolve, join} from 'node:path'
import type {Manifest} from 'vite'
import { pathToFileURL } from "node:url"
import {loadConfig} from "../utils/load-config";
import {collectEncode} from "../utils/turbo-serializer";
import {devixLog} from "../utils/log";
import { progressBar } from '@nijil71/lumi-cli'

const userConfig = await loadConfig(process.cwd(), process.env.NODE_ENV ?? 'production')
if (userConfig.output !== 'static') {
    devixLog.warn('Tip: set output: "static" in devix.config.ts to skip the SSR server at runtime.')
}

await import('./build.js')

const t = Date.now()
const renderModule = await import(pathToFileURL(resolve(process.cwd(), 'dist/server/render.js')).href + `?t=${t}`)

const manifest: Manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), 'dist/client/.vite/manifest.json'), 'utf-8')
)

const urls: string[] = await renderModule.getStaticRoutes()

const bar = progressBar({
    total: urls.length,
    style: 'bracket',
    label: `Generating ${urls.length} page${urls.length === 1 ? '' : 's'}`,
    width: 40,
}).start()

let skipped = 0

for (const url of urls) {
    const fullUrl = `http://localhost${url}`
    const {html, statusCode} = await renderModule.render(fullUrl, new Request(fullUrl), {manifest})

    if (statusCode !== 200) {
        bar.increment(1, `Skipping ${url} — ${statusCode}`)
        skipped++
        continue
    }

    const outPath = url === '/'
        ? join(process.cwd(), 'dist/client/index.html')
        : join(process.cwd(), 'dist/client', url, 'index.html')

    mkdirSync(join(outPath, '..'), {recursive: true})
    writeFileSync(outPath, `<!DOCTYPE html>${html}`, 'utf-8')

    const data = await renderModule.runLoader(fullUrl, new Request(fullUrl), {manifest})
    const dataPath = url === '/'
        ? join(process.cwd(), 'dist/client/_devix/data/index.turbo')
        : join(process.cwd(), 'dist/client/_devix/data', `${url}.turbo`)

    mkdirSync(join(dataPath, '..'), {recursive: true})
    const turboStr = await collectEncode(data)
    writeFileSync(dataPath, Buffer.from(turboStr, 'utf-8'))

    bar.increment(1, url)
}

bar.complete(`Generated ${urls.length - skipped} page${urls.length - skipped === 1 ? '' : 's'} in ${Date.now() - t}ms`)

if (userConfig.output === 'static') {
    rmSync(resolve(process.cwd(), 'dist/server'), { recursive: true, force: true })
    devixLog.info('Removed dist/server (not needed in static mode)')
}

export {}
