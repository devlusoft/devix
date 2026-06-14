import type { UserConfig } from 'vite'
import solid from 'vite-plugin-solid'
import type { ResolvedDevixConfig } from '../config/define-config'
import { dataTransform } from '../data/vite-plugin'
import { router } from '../router/plugin'
import { devixServer } from '../server/plugin'

export function preset(config: ResolvedDevixConfig, command?: 'dev' | 'build'): UserConfig {
  if (command !== 'build') {
    return {
      plugins: [solid({ ssr: true }), router(), devixServer(), dataTransform()],
      appType: 'custom',
      build: { outDir: config.outDir },
      base: config.base,
      server: { host: config.host },
      ssr: { noExternal: ['@devlusoft/devix'] },
    }
  }

  return {
    plugins: [solid({ ssr: true }), router(), dataTransform()],
    appType: 'custom',
    base: config.base,
    environments: {
      client: {
        build: {
          outDir: 'dist/client',
          manifest: true,
          rolldownOptions: {
            input: { 'entry-client': 'entry-client' },
            output: {
              entryFileNames: 'assets/[name]-[hash].js',
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
        },
      },
      ssr: {
        build: {
          ssr: true,
          outDir: 'dist/server',
          emptyOutDir: false,
          rolldownOptions: {
            input: { index: 'index' },
            external: ['hono', '@hono/node-server', '@hono/node-server/serve-static'],
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: '_chunks/[name]-[hash].js',
            },
          },
        },
        resolve: {
          noExternal: ['@devlusoft/devix'],
        },
      },
    },
  }
}
