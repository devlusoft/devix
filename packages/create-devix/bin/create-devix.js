#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { cp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(__dirname, '../templates')

const reset  = '\x1b[0m'
const bold   = '\x1b[1m'
const dim    = '\x1b[2m'
const green  = '\x1b[32m'
const cyan   = '\x1b[36m'
const yellow = '\x1b[33m'

function log(msg) { process.stdout.write(msg + '\n') }

const rl = createInterface({ input: process.stdin, output: process.stdout })

log('')
log(`${bold}  devix${reset} ${dim}— create a new project${reset}`)
log('')

let projectName = process.argv[2]

if (!projectName) {
    projectName = await rl.question(`  ${dim}project name:${reset} `)
    if (!projectName.trim()) projectName = 'my-devix-app'
}

projectName = projectName.trim()
const targetDir = resolve(process.cwd(), projectName)

if (existsSync(targetDir)) {
    const overwrite = await rl.question(`  ${yellow}${projectName}${reset} already exists. Overwrite? ${dim}(y/N)${reset} `)
    if (!overwrite.trim().toLowerCase().startsWith('y')) {
        log(`\n  ${dim}Cancelled.${reset}\n`)
        rl.close()
        process.exit(0)
    }
}

rl.close()

log('')
log(`  Creating ${cyan}${projectName}${reset}...`)

await mkdir(targetDir, { recursive: true })
await cp(join(templatesDir, 'default'), targetDir, { recursive: true })

const gitignoreSrc = join(targetDir, '_gitignore')
const gitignoreDst = join(targetDir, '.gitignore')
if (existsSync(gitignoreSrc)) {
    await cp(gitignoreSrc, gitignoreDst)
    await import('node:fs').then(fs => fs.promises.unlink(gitignoreSrc))
}

const pkgPath = join(targetDir, 'package.json')
const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
pkg.name = projectName
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')

log(`  ${green}✓${reset} Done`)
log('')
log(`  ${dim}Next steps:${reset}`)
log('')
log(`    ${cyan}cd ${projectName}${reset}`)
log(`    ${cyan}npm install${reset}`)
log(`    ${cyan}npm run dev${reset}`)
log('')
