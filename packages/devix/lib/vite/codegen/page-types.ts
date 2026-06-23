import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {join, relative} from "node:path";

function walkPages(dir: string, root: string): string[] {
    const entries: string[] = []
    for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
            entries.push(...walkPages(full, root))
        } else if (/\.(ts|tsx)$/.test(name) && name !== 'layout.tsx' && name !== 'error.tsx') {
            entries.push(relative(root, full).replace(/\\/g, '/'))
        }
    }
    return entries
}

export function generatePageTypesDts(): string {
    return '// auto-generado por devix - no editar\nexport type PageData = undefined\nexport type PageParams = Record<string, string>\n'
}

export interface WritePageTypesResult {
    warnings: string[]
}

export function writePageTypes(pageRelPath: string, root: string): WritePageTypesResult {
    const typesDir = join(root, '.devix', 'pages', pageRelPath.replace(/\.(tsx?|jsx?)$/, ''))
    const outPath = join(typesDir, '$types.d.ts')

    const content = generatePageTypesDts()

    if (existsSync(outPath) && readFileSync(outPath, 'utf-8') === content) return {warnings: []}

    mkdirSync(typesDir, {recursive: true})
    writeFileSync(outPath, content, 'utf-8')
    return {warnings: []}
}

export function deletePageTypes(pageRelPath: string, root: string): void {
    const typesDir = join(root, '.devix', 'pages', pageRelPath.replace(/\.(tsx?|jsx?)$/, ''))
    const outPath = join(typesDir, '$types.d.ts')
    if (existsSync(outPath)) rmSync(outPath)
}

export function scanAndWritePageTypes(appDir: string, root: string): WritePageTypesResult {
    const pagesDir = join(root, appDir, 'pages')
    const warnings: string[] = []
    let files: string[]
    try {
        files = walkPages(pagesDir, root)
    } catch {
        return {warnings}
    }
    for (const file of files) {
        try {
            const result = writePageTypes(file, root)
            warnings.push(...result.warnings)
        } catch {
            /* ignorar archivos no procesables */
        }
    }
    return {warnings}
}