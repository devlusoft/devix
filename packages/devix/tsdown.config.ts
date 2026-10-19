import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'lib/**/*.ts',
    '!lib/**/*.test.ts',
    '!lib/**/virtual.d.ts',
  ],
  format: ['esm'],
  platform: 'node',
  fixedExtension: false,
  target: 'node22',
  sourcemap: false,
  minify: true,
  treeshake: true,
  dts: true,
})
