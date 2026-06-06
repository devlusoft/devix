import type { UserConfig as ViteUserConfig } from 'vite'

export type DevixConfig = {
  outDir?: string
  base?: string
  vite?: ViteUserConfig
}

export type ResolvedDevixConfig = {
  outDir: string
  base: string
  vite: ViteUserConfig
}

export const DEFAULTS = {
  outDir: 'dist',
  base: '/',
} as const satisfies Required<Omit<ResolvedDevixConfig, 'vite'>>

export function defineConfig(config: DevixConfig): DevixConfig {
  return config
}
