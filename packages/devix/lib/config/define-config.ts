import type { UserConfig as ViteUserConfig } from 'vite'

export type DevixConfig = {
  outDir?: string
  base?: string
  port?: number
  host?: string | boolean
  output?: 'server' | 'static'
  vite?: ViteUserConfig
}

export type ResolvedDevixConfig = {
  outDir: string
  base: string
  port: number
  host: string | boolean
  output: 'server' | 'static'
  vite: ViteUserConfig
}

export const DEFAULTS = {
  outDir: 'dist',
  base: '/',
  port: 3000,
  host: true,
  output: 'server',
} as const

export function defineConfig(config: DevixConfig): DevixConfig {
  return config
}
