import {describe, it, expect} from 'vitest'
import {safeJsonStringify, escapeAttr} from '../../src/utils/html'

describe('safeJsonStringify', () => {
    it('serializa valores normales', () => {
        expect(safeJsonStringify({foo: 'bar'})).toBe('{"foo":"bar"}')
    })

    it('escapa </script> para prevenir XSS', () => {
        const result = safeJsonStringify({html: '</script><script>alert(1)</script>'})
        expect(result).not.toContain('</script>')
        expect(result).toContain('<\\/script>')
    })

    it('escapa </script> case-insensitive', () => {
        const result = safeJsonStringify({html: '</SCRIPT>'})
        expect(result).not.toContain('</SCRIPT>')
    })

    it('maneja null', () => {
        expect(safeJsonStringify(null)).toBe('null')
    })
})

describe('escapeAttr', () => {
    it('escapa comillas dobles', () => {
        expect(escapeAttr('en"malicious')).toBe('en&quot;malicious')
    })

    it('no modifica strings normales', () => {
        expect(escapeAttr('en')).toBe('en')
    })
})