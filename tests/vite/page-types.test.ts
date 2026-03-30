import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hasLoaderExport, generatePageTypesDts, writePageTypes, deletePageTypes } from '../../src/vite/codegen/page-types'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

const FILE = 'test.tsx'

describe('hasLoaderExport', () => {
    it('detecta function declaration', () => {
        expect(hasLoaderExport(`export function loader() {}`, FILE)).toBe(true)
    })

    it('detecta async function declaration', () => {
        expect(hasLoaderExport(`export async function loader({ params }) { return {} }`, FILE)).toBe(true)
    })

    it('detecta arrow function const', () => {
        expect(hasLoaderExport(`export const loader = async () => ({})`, FILE)).toBe(true)
    })

    it('detecta re-export con specifier', () => {
        expect(hasLoaderExport(`export { loader } from './other'`, FILE)).toBe(true)
    })

    it('detecta re-export renombrado', () => {
        expect(hasLoaderExport(`export { myLoader as loader } from './other'`, FILE)).toBe(true)
    })

    it('devuelve false si no hay loader', () => {
        expect(hasLoaderExport(`export default function Page() { return null }`, FILE)).toBe(false)
    })

    it('no confunde guard con loader', () => {
        expect(hasLoaderExport(`export async function guard() {}`, FILE)).toBe(false)
    })

    it('no confunde export default con loader', () => {
        expect(hasLoaderExport(`export default async function loader() {}`, FILE)).toBe(false)
    })
})

describe('generatePageTypesDts', () => {
    describe('sin loader', () => {
        const result = generatePageTypesDts('', false)

        it('PageData es undefined', () => {
            expect(result).toContain('export type PageData = undefined')
        })

        it('PageParams es Record<string, string>', () => {
            expect(result).toContain('export type PageParams = Record<string, string>')
        })

        it('no incluye imports', () => {
            expect(result).not.toContain('import type')
        })

        it('incluye el header de advertencia', () => {
            expect(result).toContain('auto-generado por devix')
        })
    })

    describe('con loader', () => {
        const importPath = '../../../app/pages/users/[id]'
        const result = generatePageTypesDts(importPath, true)

        it('importa el loader del path correcto', () => {
            expect(result).toContain(`import type { loader } from "${importPath}"`)
        })

        it('importa Redirect de @devlusoft/devix', () => {
            expect(result).toContain(`import type { Redirect } from "@devlusoft/devix"`)
        })

        it('PageData usa Exclude/Awaited/ReturnType sobre el loader', () => {
            expect(result).toContain('Awaited<ReturnType<NonNullable<typeof loader>>>')
            expect(result).toContain('Exclude<')
            expect(result).toContain('Redirect | void | undefined')
        })

        it('PageParams usa Parameters sobre el loader', () => {
            expect(result).toContain('Parameters<typeof loader>[0]')
        })

        it('incluye el header de advertencia', () => {
            expect(result).toContain('auto-generado por devix')
        })
    })
})

describe('writePageTypes / deletePageTypes', () => {
    let root: string

    beforeEach(() => {
        root = join(tmpdir(), `devix-test-${randomBytes(4).toString('hex')}`)
        mkdirSync(root, { recursive: true })
    })

    afterEach(() => {
        rmSync(root, { recursive: true, force: true })
    })

    it('genera $types.d.ts en la ruta correcta para una página con loader', () => {
        const pageRelPath = 'app/pages/users/[id].tsx'
        mkdirSync(join(root, 'app/pages/users'), { recursive: true })
        writeFileSync(join(root, pageRelPath), `export const loader = async ({ params }) => ({ user: { name: 'test' } })\nexport default function Page() { return null }`)

        writePageTypes(pageRelPath, root)

        const outPath = join(root, '.devix', 'pages', 'app/pages/users/[id]', '$types.d.ts')
        expect(existsSync(outPath)).toBe(true)
        const content = readFileSync(outPath, 'utf-8')
        expect(content).toContain('import type { loader }')
        expect(content).toContain('export type PageData')
        expect(content).toContain('export type PageParams')
    })

    it('genera $types.d.ts con tipos vacíos para una página sin loader', () => {
        const pageRelPath = 'app/pages/about.tsx'
        mkdirSync(join(root, 'app/pages'), { recursive: true })
        writeFileSync(join(root, pageRelPath), `export default function About() { return null }`)

        writePageTypes(pageRelPath, root)

        const outPath = join(root, '.devix', 'pages', 'app/pages/about', '$types.d.ts')
        expect(existsSync(outPath)).toBe(true)
        const content = readFileSync(outPath, 'utf-8')
        expect(content).toContain('export type PageData = undefined')
        expect(content).toContain('export type PageParams = Record<string, string>')
        expect(content).not.toContain('import type')
    })

    it('no reescribe el archivo si el contenido no cambia', () => {
        const pageRelPath = 'app/pages/about.tsx'
        mkdirSync(join(root, 'app/pages'), { recursive: true })
        writeFileSync(join(root, pageRelPath), `export default function About() { return null }`)

        writePageTypes(pageRelPath, root)
        const outPath = join(root, '.devix', 'pages', 'app/pages/about', '$types.d.ts')
        const mtime1 = statSync(outPath).mtimeMs

        writePageTypes(pageRelPath, root)
        const mtime2 = statSync(outPath).mtimeMs

        expect(mtime1).toBe(mtime2)
    })

    it('deletePageTypes elimina el archivo generado', () => {
        const pageRelPath = 'app/pages/about.tsx'
        mkdirSync(join(root, 'app/pages'), { recursive: true })
        writeFileSync(join(root, pageRelPath), `export default function About() { return null }`)
        writePageTypes(pageRelPath, root)

        const outPath = join(root, '.devix', 'pages', 'app/pages/about', '$types.d.ts')
        expect(existsSync(outPath)).toBe(true)

        deletePageTypes(pageRelPath, root)
        expect(existsSync(outPath)).toBe(false)
    })

    it('deletePageTypes no falla si el archivo no existe', () => {
        expect(() => deletePageTypes('app/pages/nonexistent.tsx', root)).not.toThrow()
    })
})