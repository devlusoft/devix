import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {join, relative} from "node:path";
import {parseSync} from "oxc-parser";

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

export function hasLoaderExport(code: string, filePath: string): boolean {
    const ast = parseSync(filePath, code, {sourceType: 'module'})
    for (const node of ast.program.body) {
        if (node.type !== 'ExportNamedDeclaration') continue
        const decl = node.declaration
        if (decl?.type === 'FunctionDeclaration' && decl.id?.name === 'loader') return true
        if (decl?.type === 'VariableDeclaration') {
            for (const d of decl.declarations) {
                if (d.id.type === 'Identifier' && d.id.name === 'loader') return true
            }
        }
        for (const spec of (node.specifiers ?? [])) {
            if (spec.exported.type === 'Identifier' && spec.exported.name === 'loader') return true
        }
    }
    return false
}

export function generatePageTypesDts(importPath: string, withLoader: boolean): string {
    if (!withLoader) {
        return '// auto-generado por devix - no editar\nexport type PageData = undefined\nexport type PageParams = Record<string, string>\n'
    }
    return `// auto-generado por devix — no editar\nimport type { loader } from "${importPath}"\nimport type { Redirect } from "@devlusoft/devix"\n\nexport type PageData = Exclude<\n    Awaited<ReturnType<NonNullable<typeof loader>>>,\n    Redirect | void | undefined\n>\nexport type PageParams = NonNullable<Parameters<typeof loader>[0]>["params"]\n`
}

export function writePageTypes(pageRelPath: string, root: string): void {
    const fullPath = join(root, pageRelPath)
    const code = readFileSync(fullPath, 'utf-8')
    const withLoader = hasLoaderExport(code, fullPath)

    const typesDir = join(root, '.devix', 'pages', pageRelPath.replace(/\.(tsx?|jsx?)$/, ''))
    const outPath = join(typesDir, '$types.d.ts')

    const pageAbsNoExt = fullPath.replace(/\.(tsx?|jsx?)$/, '')
    const importPath = relative(typesDir, pageAbsNoExt).replace(/\\/g, '/')

    const content = generatePageTypesDts(importPath, withLoader)

    if (existsSync(outPath) && readFileSync(outPath, 'utf-8') === content) return

    mkdirSync(typesDir, {recursive: true})
    writeFileSync(outPath, content, 'utf-8')
}

export function deletePageTypes(pageRelPath: string, root: string): void {
    const typesDir = join(root, '.devix', 'pages', pageRelPath.replace(/\.(tsx?|jsx?)$/, ''))
    const outPath = join(typesDir, '$types.d.ts')
    if (existsSync(outPath)) rmSync(outPath)
}

export function scanAndWritePageTypes(appDir: string, root: string): void {
    const pagesDir = join(root, appDir, 'pages')
    let files: string[]
    try {
        files = walkPages(pagesDir, root)
    } catch {
        return
    }
    for (const file of files) {
        try {
            writePageTypes(file, root)
        } catch {
            /* ignorar archivos no procesables */
        }
    }
}