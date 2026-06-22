import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'
import {extractHttpMethods} from './extract-methods'
import {buildRouteEntry} from './routes-dts'
import type {RouteEntry} from './routes-dts'

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

export function scanApiFiles(appDir: string, projectRoot: string): RouteEntry[] {
    const apiDir = join(projectRoot, appDir, 'api')

    let files: string[]
    try {
        files = walkDir(apiDir, projectRoot)
    } catch {
        return []
    }

    return files
        .filter(f => !f.endsWith('middleware.ts') && !f.endsWith('middleware.tsx'))
        .flatMap(filePath => {
            try {
                const content = readFileSync(join(projectRoot, filePath), 'utf-8')
                const methods = extractHttpMethods(content)
                if (methods.length === 0) return []
                return [buildRouteEntry(filePath, `${appDir}/api`, methods)]
            } catch {
                return []
            }
        })
}
