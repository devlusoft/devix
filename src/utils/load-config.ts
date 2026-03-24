import {build} from 'esbuild'
import type {DevixConfig} from "../config"
import {join} from "node:path"
import {unlinkSync, writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

export async function loadConfig(cwd: string): Promise<DevixConfig> {
    const result = await build({
        entryPoints: [join(cwd, 'devix.config.ts')],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
        packages: 'external',
    })

    const tmpFile = join(cwd, `.devix-config-${Date.now()}.mjs`)
    writeFileSync(tmpFile, result.outputFiles[0].text)

    try {
        const mod = await import(pathToFileURL(tmpFile).href)
        return mod.default
    } finally {
        unlinkSync(tmpFile)
    }
}