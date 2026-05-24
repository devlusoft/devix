import {existsSync, rmSync} from "node:fs";
import {join} from "node:path";

export function hasLoaderExport(_code: string, _filePath: string): boolean {
    return false
}

export function generatePageTypesDts(): string {
    return '// auto-generado por devix - no editar (loader deprecated)\nexport type PageData = undefined\nexport type PageParams = Record<string, string>\n'
}

export interface WritePageTypesResult {
    warnings: string[]
}

export function writePageTypes(_pageRelPath: string, _root: string): WritePageTypesResult {
    return {warnings: []}
}

export function deletePageTypes(pageRelPath: string, root: string): void {
    const typesDir = join(root, '.devix', 'pages', pageRelPath.replace(/\.(tsx?|jsx?)$/, ''))
    const outPath = join(typesDir, '$types.d.ts')
    if (existsSync(outPath)) rmSync(outPath)
}

export function scanAndWritePageTypes(_appDir: string, _root: string): WritePageTypesResult {
    return {warnings: []}
}