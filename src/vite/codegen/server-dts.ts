import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import type {DevixConfig} from '../../config'

export function generateServerDts(server: DevixConfig['server']): string {
    const namespaces = server ? Object.keys(server) : []

    if (namespaces.length === 0) {
        return `// auto-generado por devix — no editar\nexport {}\ndeclare module '@devlusoft/devix' {\n  interface ServerNamespaces {}\n}\n`
    }

    const lines = namespaces.map(ns => `    ${ns}: true`).join('\n')
    return `// auto-generado por devix — no editar
export {}
declare module '@devlusoft/devix' {
  interface ServerNamespaces {
${lines}
  }
}
`
}

export function writeServerDts(content: string, projectRoot: string): boolean {
    const devixDir = join(projectRoot, '.devix')
    const outPath = join(devixDir, 'server.d.ts')

    mkdirSync(devixDir, {recursive: true})

    if (existsSync(outPath) && readFileSync(outPath, 'utf-8') === content) {
        return false
    }

    writeFileSync(outPath, content, 'utf-8')
    return true
}
