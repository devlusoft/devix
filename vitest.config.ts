import { resolve } from 'node:path'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid({ ssr: true })],
  resolve: {
    alias: {
      '@devlusoft/devix': resolve(__dirname, './packages/devix/lib/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['./local/**', '**/node_modules/**', '**/dist/**', '**/*.e2e.test.{ts,tsx}'],
  },
})
