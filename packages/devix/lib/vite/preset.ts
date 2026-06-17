import { createRequire } from 'node:module'
import type { Plugin } from 'vite'
import type { UserConfig } from 'vite'
import solid from 'vite-plugin-solid'
import type { ResolvedDevixConfig } from '../config/define-config'
import { dataTransform } from '../data/vite-plugin'
import { router } from '../router/plugin'
import { devixServer } from '../server/plugin'
import { solidRouterSsrResolve } from './solid-router-ssr'

const require = createRequire(import.meta.url)
const SOLID_WEB_SERVER_ENTRY = require.resolve('solid-js/web/dist/server.cjs')

function solidWebSsrResolve(): Plugin {
  return {
    name: 'devix:solid-web-ssr',
    enforce: 'pre',
    config() {
      return {
        resolve: {
          alias: [
            { find: /^solid-js\/web$/, replacement: SOLID_WEB_SERVER_ENTRY },
          ],
        },
        ssr: {
          noExternal: ['solid-js/web'],
        },
      }
    },
  }
}

export function preset(config: ResolvedDevixConfig, command?: 'dev' | 'build'): UserConfig {
  const plugins = [
    solid({ ssr: true }),
    solidRouterSsrResolve(),
    solidWebSsrResolve(),
    router(),
    dataTransform(),
  ]

  if (command !== 'build') {
    return {
      plugins: [...plugins, devixServer()],
      appType: 'custom',
      build: { outDir: config.outDir },
      base: config.base,
      server: { host: config.host },
      resolve: { conditions: ['browser', 'module', 'solid', 'import', 'default'] },
      ssr: {
        noExternal: ['@devlusoft/devix'],
      },
    }
  }

  return {
    plugins,
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
        resolve: { conditions: ['browser', 'module', 'solid', 'import', 'default'] },
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
