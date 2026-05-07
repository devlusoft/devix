// @vitest-environment jsdom
import {describe, it, expect, beforeEach} from 'vitest'
import {resolveTo} from '../../src/runtime/url'

function setLocation(pathnameAndSearch: string) {
    window.history.replaceState(null, '', pathnameAndSearch)
}

describe('resolveTo — internos', () => {
    beforeEach(() => {
        setLocation('/productos')
    })

    it('?query mantiene el pathname actual y reemplaza search', () => {
        const r = resolveTo('?page=2')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.pathname).toBe('/productos')
        expect(r.href).toBe('/productos?page=2')
    })

    it('#hash mantiene pathname y search actuales', () => {
        setLocation('/productos?page=2')
        const r = resolveTo('#section')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.href).toBe('/productos?page=2#section')
    })

    it('./relativo se resuelve respecto al pathname actual como directorio', () => {
        const r = resolveTo('./detail/1')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.pathname).toBe('/productos/detail/1')
        expect(r.href).toBe('/productos/detail/1')
    })

    it('../ sube un nivel desde el pathname actual', () => {
        setLocation('/productos/123')
        const r = resolveTo('../sellers')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.pathname).toBe('/productos/sellers')
    })

    it('/absoluto reemplaza el pathname completo', () => {
        const r = resolveTo('/categorias')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.pathname).toBe('/categorias')
        expect(r.href).toBe('/categorias')
    })

    it('strip de trailing slash en pathname (excepto raíz)', () => {
        const r = resolveTo('/productos/')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.pathname).toBe('/productos')
    })

    it('mantiene "/" para la raíz', () => {
        const r = resolveTo('/')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.pathname).toBe('/')
        expect(r.href).toBe('/')
    })

    it('combina path absoluto con search y hash', () => {
        const r = resolveTo('/productos?page=2#top')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.href).toBe('/productos?page=2#top')
    })
})

describe('resolveTo — externos', () => {
    beforeEach(() => {
        setLocation('/productos')
    })

    it('URL absoluta a otro origin se marca como external', () => {
        const r = resolveTo('https://otra.com/x')
        expect(r.kind).toBe('external')
        if (r.kind !== 'external') return
        expect(r.url.href).toBe('https://otra.com/x')
    })

    it('URL absoluta al mismo origin sigue siendo internal', () => {
        const r = resolveTo(window.location.origin + '/productos?page=2')
        expect(r.kind).toBe('internal')
        if (r.kind !== 'internal') return
        expect(r.href).toBe('/productos?page=2')
    })
})
