import { defineConfig } from 'tsdown'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
  entry: [
    'lib/**/*.ts',
    '!lib/**/*.test.ts',
    '!lib/**/virtual.d.ts',
  ],
  format: ['esm'],
  platform: 'node',
  fixedExtension: false,
  target: 'node20',
  sourcemap: false,
  minify: true,
  treeshake: true,
  dts: true,
  define: {
    __DEVIX_VERSION__: JSON.stringify(pkg.version),
    __DEVIX_PROD__: 'true',
  }
})
