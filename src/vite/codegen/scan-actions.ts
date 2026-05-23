import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'

function walkDir(dir: string, root: string): string[] {
    const entries: string[] = []
    for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
            entries.push(...walkDir(full, root))
        } else if (/\.(ts|tsx)$/.test(name)) {
            entries.push(relative(root, full).replace(/\\/g, '/'))
        }
    }
    return entries
}

const EXPORT_FN_RE = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g
const EXPORT_CONST_FN_RE = /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:\w+\s*)?(?:async\s+)?(?:function\s*)?\(/

export interface ActionEntry {
    filePath: string
    functions: string[]
}

export function scanActions(appDir: string, projectRoot: string): ActionEntry[] {
    const actionsDir = join(projectRoot, appDir, 'actions')

    let files: string[]
    try {
        files = walkDir(actionsDir, projectRoot)
    } catch {
        return []
    }

    return files.flatMap(filePath => {
        try {
            const content = readFileSync(join(projectRoot, filePath), 'utf-8')
            const stripped = content
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '')

            const fns = new Set<string>()
            for (const match of stripped.matchAll(EXPORT_FN_RE)) {
                fns.add(match[1])
            }
            for (const match of stripped.matchAll(EXPORT_CONST_FN_RE)) {
                fns.add(match[1])
            }

            if (fns.size === 0) return []
            return [{filePath, functions: [...fns]}]
        } catch {
            return []
        }
    })
}
