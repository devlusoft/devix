import {build} from 'esbuild'
import {solidPlugin} from 'esbuild-plugin-solid'
import {readdirSync, readFileSync, globSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {execSync} from 'node:child_process'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))

const allEntryPoints = (readdirSync('src', {recursive: true}) as string[])
    .filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('.test.') && !f.endsWith('virtual.d.ts'))
    .map(f => join('src', f))

await build({
    entryPoints: allEntryPoints,
    outdir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    bundle: true,
    packages: 'external',
    define: {
        __DEVIX_VERSION__: JSON.stringify(pkg.version),
    },
    jsx: 'preserve',
    plugins: [solidPlugin({
        solid: {hydratable: true, generate: "ssr"},
        typescript: {onlyRemoveTypeImports: true},
    })],
    sourcemap: true,
    minify: true,
})

await build({
    entryPoints: {'runtime/index': 'src/runtime/index.ts'},
    outdir: 'dist/source',
    outExtension: {'.js': '.jsx'},
    format: 'esm',
    platform: 'node',
    target: 'node20',
    bundle: true,
    packages: 'external',
    define: {
        __DEVIX_VERSION__: JSON.stringify(pkg.version),
    },
    jsx: 'preserve',
    sourcemap: true,
    minify: false,
})

const serverEntries = [
    'src/server/render.tsx',
    'src/server/stream-html.ts',
    'src/server/api.ts',
    'src/server/actions.ts',
    'src/server/routes.ts',
    'src/server/pages-router.ts',
    'src/server/api-router.ts',
    'src/server/server-proxy.ts',
    'src/server/server-bound.ts',
    'src/server/handler-store.ts',
    'src/server/public-index.ts',
    'src/server/collect-css.ts',
    'src/server/index.ts',
]

await build({
    entryPoints: serverEntries,
    outdir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    bundle: true,
    packages: 'external',
    jsx: 'preserve',
    plugins: [solidPlugin({
        solid: {hydratable: true, generate: 'ssr'},
        typescript: {onlyRemoveTypeImports: true},
    })],
    outbase: 'src',
    outExtension: {'.js': '.jsx'},
    sourcemap: true,
    minify: true,
})

execSync('npx tsc -p tsconfig.build.json', {stdio: 'inherit'})

for (const f of globSync('dist/**/*.map')) rmSync(f)
for (const f of globSync('dist/server/*.jsx')) rmSync(f)

console.log('✓ devix built')
