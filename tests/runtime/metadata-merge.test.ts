import {describe, it, expect} from 'vitest'
import {mergeMetadata} from '../../src/runtime/metadata'

describe('mergeMetadata', () => {
    it('retorna objeto vacío si no hay fuentes', () => {
        expect(mergeMetadata()).toEqual({})
    })

    it('ignora null y undefined', () => {
        expect(mergeMetadata(null, undefined, {title: 'Hola'})).toEqual({title: 'Hola'})
    })

    it('la última fuente sobreescribe la anterior', () => {
        const result = mergeMetadata({title: 'Base'}, {title: 'Override'})
        expect(result.title).toBe('Override')
    })

    it('mergea og de múltiples fuentes', () => {
        const result = mergeMetadata(
            {og: {title: 'Base OG', description: 'Desc'}},
            {og: {title: 'Override OG'}}
        )
        expect(result.og?.title).toBe('Override OG')
        expect(result.og?.description).toBe('Desc')
    })

    it('mergea twitter de múltiples fuentes', () => {
        const result = mergeMetadata(
            {twitter: {card: 'summary', title: 'Base'}},
            {twitter: {title: 'Override'}}
        )
        expect(result.twitter?.card).toBe('summary')
        expect(result.twitter?.title).toBe('Override')
    })

    it('layout + página — página gana en campos planos', () => {
        const layout = {title: 'Site Name', description: 'Site desc', og: {title: 'Site OG'}}
        const page = {title: 'Page Title', og: {title: 'Page OG', image: '/img.png'}}
        const result = mergeMetadata(layout, page)
        expect(result.title).toBe('Page Title')
        expect(result.description).toBe('Site desc')
        expect(result.og?.title).toBe('Page OG')
        expect(result.og?.image).toBe('/img.png')
    })
})