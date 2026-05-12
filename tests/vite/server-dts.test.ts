import {describe, it, expect} from 'vitest'
import {generateServerDts} from '../../src/vite/codegen/server-dts'

describe('generateServerDts', () => {
    it('emite interface vacía si no hay server config', () => {
        const result = generateServerDts(undefined)
        expect(result).toContain('interface ServerNamespaces {}')
        expect(result).toContain('auto-generado')
    })

    it('emite interface vacía si server es objeto sin claves', () => {
        const result = generateServerDts({})
        expect(result).toContain('interface ServerNamespaces {}')
    })

    it('genera un namespace', () => {
        const result = generateServerDts({
            api: {url: 'http://localhost:8080', allowedPaths: ['/v1/**']},
        })
        expect(result).toMatch(/interface ServerNamespaces\s*\{\s*api: true\s*\}/)
    })

    it('genera múltiples namespaces', () => {
        const result = generateServerDts({
            api: {url: 'http://api.example.com', allowedPaths: ['/v1/**']},
            payments: {url: 'http://pay.example.com', allowedPaths: ['/v1/**']},
        })
        expect(result).toContain('api: true')
        expect(result).toContain('payments: true')
    })

    it('declara module augmentation sobre @devlusoft/devix', () => {
        const result = generateServerDts({
            api: {url: 'http://localhost:8080'},
        })
        expect(result).toContain("declare module '@devlusoft/devix'")
    })

    it('incluye export {} para que el archivo sea tratado como módulo', () => {
        expect(generateServerDts(undefined)).toContain('export {}')
        expect(generateServerDts({api: {url: 'http://x'}})).toContain('export {}')
    })
})
