import {writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'vite'
import type {DevixConfig} from '../config'
import {devix} from '../vite'
import {parseDuration} from '../utils/duration'

const config: DevixConfig = (await import(`${process.cwd()}/devix.config.ts`)).default
const baseConfig = devix(config)

await build({
    ...baseConfig,
    configFile: false,
    build: {
        outDir: 'dist/client',
        manifest: true,
        rolldownOptions: {
            input: 'virtual:devix/entry-client',
        },
    },
})

await build({
    ...baseConfig,
    configFile: false,
    build: {
        ssr: true,
        outDir: 'dist/server',
        rolldownOptions: {
            input: {
                render: 'virtual:devix/render',
                api: 'virtual:devix/api',
            },
        },
    },
})

const runtimeConfig = {
    port: config.port ?? 3000,
    host: config.host ?? false,
    loaderTimeout: parseDuration(config.loaderTimeout ?? 10_000),
    output: config.output ?? 'server',
}

writeFileSync(
    resolve(process.cwd(), 'dist/devix.config.json'),
    JSON.stringify(runtimeConfig, null, 2),
    'utf-8'
)


export {}