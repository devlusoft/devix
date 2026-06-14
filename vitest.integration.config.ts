import { resolve } from 'node:path'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'
import { dataTransform } from './packages/devix/lib/data/vite-plugin'

export default defineConfig({
  plugins: [solid({ ssr: true }), dataTransform()],
  resolve: {
    alias: {
      '@devlusoft/devix': resolve(__dirname, './packages/devix/lib/index.ts'),
    },
  },
  ssr: {
    noExternal: ['@solidjs/router'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.e2e.test.{ts,tsx}'],
  },
})
