import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

export function writeActionsDts(content: string, projectRoot: string): boolean {
    const devixDir = join(projectRoot, '.devix')
    const outPath = join(devixDir, 'actions.d.ts')

    mkdirSync(devixDir, {recursive: true})

    if (existsSync(outPath) && readFileSync(outPath, 'utf-8') === content) {
        return false
    }

    writeFileSync(outPath, content, 'utf-8')
    return true
}
