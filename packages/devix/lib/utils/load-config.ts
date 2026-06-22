import {build} from 'esbuild'
import type {DevixConfig} from "../config"
import {join} from "node:path"
import {unlinkSync, writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {loadDotenv} from "./env"

export async function loadConfig(
    cwd: string,
    mode: string = process.env.NODE_ENV ?? 'development',
): Promise<DevixConfig> {
    loadDotenv(mode)

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