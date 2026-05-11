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

export interface LoaderExportInfo {
    exists: boolean
    isAsync: boolean
    isReExport: boolean
}

export function inspectLoaderExport(code: string, filePath: string): LoaderExportInfo {
    const ast = parseSync(filePath, code, {sourceType: 'module'})
    for (const node of ast.program.body) {
        if (node.type !== 'ExportNamedDeclaration') continue
        const decl = node.declaration
        if (decl?.type === 'FunctionDeclaration' && decl.id?.name === 'loader') {
            return {exists: true, isAsync: decl.async, isReExport: false}
        }
        if (decl?.type === 'VariableDeclaration') {
            for (const d of decl.declarations) {
                if (d.id.type === 'Identifier' && d.id.name === 'loader') {
                    const init = d.init
                    const isAsync =
                        (init?.type === 'ArrowFunctionExpression' && init.async) ||
                        (init?.type === 'FunctionExpression' && init.async)
                    return {exists: true, isAsync, isReExport: false}
                }
            }
        }
        for (const spec of (node.specifiers ?? [])) {
            if (spec.exported.type === 'Identifier' && spec.exported.name === 'loader') {
                return {exists: true, isAsync: false, isReExport: true}
            }
        }
    }
    return {exists: false, isAsync: false, isReExport: false}
}

export function hasLoaderExport(code: string, filePath: string): boolean {
    return inspectLoaderExport(code, filePath).exists
}

export function generatePageTypesDts(importPath: string, withLoader: boolean): string {
    if (!withLoader) {
        return '// auto-generado por devix - no editar\nexport type PageData = undefined\nexport type PageParams = Record<string, string>\n'
    }
    return `// auto-generado por devix — no editar\nimport type { loader } from "${importPath}"\nimport type { Redirect } from "@devlusoft/devix"\n\nexport type PageData = Exclude<\n    Awaited<ReturnType<NonNullable<typeof loader>>>,\n    Redirect | void | undefined\n>\nexport type PageParams = NonNullable<Parameters<typeof loader>[0]>["params"]\n`
}

export interface WritePageTypesResult {
    warnings: string[]
}

export function writePageTypes(pageRelPath: string, root: string): WritePageTypesResult {
    const fullPath = join(root, pageRelPath)
    const code = readFileSync(fullPath, 'utf-8')
    const loaderInfo = inspectLoaderExport(code, fullPath)
    const warnings: string[] = []

    if (loaderInfo.exists && !loaderInfo.isAsync && !loaderInfo.isReExport) {
        warnings.push(
            `[devix] ${pageRelPath}: 'loader' must be async. ` +
            `Use 'export async function loader' or 'export const loader = async (...) => ...'.`
        )
    }

    const typesDir = join(root, '.devix', 'pages', pageRelPath.replace(/\.(tsx?|jsx?)$/, ''))
    const outPath = join(typesDir, '$types.d.ts')

    const pageAbsNoExt = fullPath.replace(/\.(tsx?|jsx?)$/, '')
    const importPath = relative(typesDir, pageAbsNoExt).replace(/\\/g, '/')

    const content = generatePageTypesDts(importPath, loaderInfo.exists)

    if (existsSync(outPath) && readFileSync(outPath, 'utf-8') === content) return {warnings}

    mkdirSync(typesDir, {recursive: true})
    writeFileSync(outPath, content, 'utf-8')
    return {warnings}
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