import {build} from 'esbuild'
import {readdirSync} from 'node:fs'
import {join} from 'node:path'
import {execSync} from 'node:child_process'

const entryPoints = (readdirSync('src', {recursive: true}) as string[])
    .filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('.test.') && !f.endsWith('virtual.d.ts'))
    .map(f => join('src', f))

await build({
    entryPoints,
    outdir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    bundle: true,
    packages: 'external',
    jsx: 'automatic',
    sourcemap: true,
    minify: true,
})

execSync('tsc -p tsconfig.build.json', {stdio: 'inherit'})

console.log('✓ devix built')