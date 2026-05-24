import { describe, it, expect } from 'vitest'
import { hasLoaderExport, generatePageTypesDts, writePageTypes, deletePageTypes } from '../../src/vite/codegen/page-types'

describe('page-types stubs (loader deprecated)', () => {
    it('hasLoaderExport always returns false', () => {
        expect(hasLoaderExport('export function loader() {}', 'test.ts')).toBe(false)
    })

    it('generatePageTypesDts returns basic types', () => {
        const result = generatePageTypesDts()
        expect(result).toContain('PageData = undefined')
        expect(result).toContain('PageParams = Record<string, string>')
    })

    it('writePageTypes returns empty warnings', () => {
        const result = writePageTypes('', '')
        expect(result).toEqual({ warnings: [] })
    })

    it('deletePageTypes does not throw on non-existent file', () => {
        expect(() => deletePageTypes('app/pages/nonexistent.tsx', '/tmp')).not.toThrow()
    })
})
