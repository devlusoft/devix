import type {ActionEntry} from './scan-actions'

function filePathToNamespace(filePath: string, appDir: string): string {
    return filePath
        .slice(`${appDir}/actions/`.length)
        .replace(/\.(ts|tsx)$/, '')
        .split('/')
        .filter(Boolean)
        .map(seg => seg.replace(/[^a-zA-Z0-9_$]/g, '_'))
        .join('_')
}

export function generateActionsDts(entries: ActionEntry[], appDir: string): string {
    if (entries.length === 0) {
        return `// auto-generado por devix — no editar\nexport {}\ndeclare module '@devlusoft/devix' {\n  interface Actions {}\n}\n`
    }

    const lines: string[] = []
    const imports: string[] = []

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i]
        const importPath = '../' + e.filePath.replace(/\.(ts|tsx)$/, '')
        const ident = `__ActionsType_${i}`
        imports.push(`import type * as ${ident} from '${importPath}'`)

        const ns = filePathToNamespace(e.filePath, appDir)
        lines.push(`    ${ns}: typeof ${ident}`)
    }

    return `// auto-generado por devix — no editar
${imports.join('\n')}

declare module '@devlusoft/devix' {
  interface Actions {
${lines.join('\n')}
  }
}
`
}
