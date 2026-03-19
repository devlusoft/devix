import type { UserConfig } from "vite"

export interface DevixConfig {
    port?: number
    host?: string | boolean
    css?: string[]
    appDir?: string
    publicDir?: string
    envPrefix?: string | string[]
    html?: { lang?: string }
    vite?: UserConfig
    loaderTimeout?: number | string
    output?: 'server' | 'static'
}

export interface ResolvedDirs {
    appDir: string
    pagesDir: string
    apiDir: string
}

export function defineConfig(config: DevixConfig): DevixConfig { return config }

export function resolveDirs(config: DevixConfig): ResolvedDirs {
    const appDir = config.appDir ?? "app"
    return {
        appDir,
        pagesDir: `${appDir}/pages`,
        apiDir: `${appDir}/api`,
    }
}