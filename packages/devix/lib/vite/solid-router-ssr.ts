import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const ROUTER_SERVER_ENTRY = require.resolve('@solidjs/router', {
  conditions: new Set(['solid', 'node']),
} as unknown as Parameters<typeof require.resolve>[1])

export function solidRouterSsrResolve(): Plugin {
  return {
    name: 'devix:solid-router-ssr',
    enforce: 'pre',
    resolveId(id, _importer, options) {
      if (!options.ssr) return
      if (id === '@solidjs/router') return ROUTER_SERVER_ENTRY
    },
  }
}
