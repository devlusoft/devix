import {writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'vite'
import {devix} from '../vite'
import {parseDuration} from '../utils/duration'
import {loadConfig} from "../utils/load-config";
import {taskRunner} from '@nijil71/lumi-cli'

const config = await loadConfig(process.cwd(), process.env.NODE_ENV ?? 'production')
const baseConfig = devix(config)

const t = Date.now()

await taskRunner([
    {
        title: 'Build client',
        task: async (_, task) => {
            task.text = 'Building client bundle...'
            await build({
                ...baseConfig,
                configFile: false,
                build: {
                    outDir: 'dist/client',
                    manifest: true,
                    rolldownOptions: {
                        input: 'virtual:devix/entry-client.jsx',
                    },
                },
            })
        },
    },
    {
        title: 'Build server',
        task: async (_, task) => {
            task.text = 'Building server bundle...'
            await build({
                ...baseConfig,
                configFile: false,
                build: {
                    ssr: true,
                    outDir: 'dist/server',
                    copyPublicDir: false,
                    rolldownOptions: {
                        input: {
                            render: 'virtual:devix/render',
                            api: 'virtual:devix/api',
                            actions: 'virtual:devix/actions',
                        },
                    },
                },
            })
        },
    },
    {
        title: 'Build server entry',
        task: async (_, task) => {
            task.text = 'Building server entry...'
            await build({
                ...baseConfig,
                configFile: false,
                build: {
                    ssr: true,
                    outDir: 'dist/server',
                    emptyOutDir: false,
                    copyPublicDir: false,
                    rolldownOptions: {
                        input: { index: 'virtual:devix/server-entry' },
                    },
                },
            })
        },
    },
], { spinner: 'bounce' }).run()

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
