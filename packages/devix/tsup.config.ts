import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { solidPlugin } from 'esbuild-plugin-solid'
import { defineConfig } from 'tsup'

const rootDir = process.cwd()

function removeIfExists(path: string): void {
  if (!existsSync(path)) return
  const stats = statSync(path)
  if (stats.isDirectory()) {
    rmSync(path, { recursive: true, force: true })
  } else {
    rmSync(path, { force: true })
  }
}

function copyStaticFiles(): void {
  const destDir = join(rootDir, 'dist')
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  const copies = [
    { src: join(rootDir, 'lib/cli/templates'), dest: join(destDir, 'cli/templates') },
    { src: join(rootDir, 'lib/ambient.d.ts'), dest: join(destDir, 'ambient.d.ts') },
    { src: join(rootDir, 'lib/env.d.ts'), dest: join(destDir, 'env.d.ts') },
  ]

  for (const { src, dest } of copies) {
    if (!existsSync(src)) continue
    removeIfExists(dest)
    cpSync(src, dest, { recursive: true })
  }
}

function copyStaticPlugin(): import('esbuild').Plugin {
  return {
    name: 'devix-copy-static',
    setup(build) {
      build.onEnd(() => {
        copyStaticFiles()
      })
    },
  }
}

export default defineConfig({
  entry: [
    'lib/index.ts',
    'lib/config/define-config.ts',
    'lib/cookie.ts',
    'lib/router/index.ts',
    'lib/router/middleware.ts',
    'lib/router/view-transitions/click-interceptor.tsx',
    'lib/data/index.ts',
    'lib/data/internal.ts',
    'lib/cli/logger.ts',
    'lib/cli/index.ts',
    'lib/cli/dev.ts',
    'lib/cli/start.ts',
    'lib/cli/build.ts',
    'lib/server/styles.ts',
  ],
  outDir: 'dist',
  format: ['esm'],
  target: 'esnext',
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  esbuildPlugins: [solidPlugin(), copyStaticPlugin()],
  external: [
    /^solid-js(\/.*)?$/,
    /^@solidjs\/router(\/.*)?$/,
    'vite',
    '@babel/generator',
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    '@hono/node-server',
    '@hono/node-server/serve-static',
    'hono',
    'jiti',
    'magicast',
    'seroval',
    'tinyglobby',
    'vite-plugin-solid',
    '@nijil71/lumi-cli',
  ],
})
