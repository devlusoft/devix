import { describe, it, expect, vi } from 'vitest'
import { mergeMetadata, resolveMetadata } from '../../src/runtime/metadata'

describe('mergeMetadata', () => {
    it('último source gana en campos simples', () => {
        expect(mergeMetadata({ title: 'A' }, { title: 'B' }).title).toBe('B')
    })
    it('preserva campos no sobreescritos', () => {
        expect(mergeMetadata({ title: 'A', description: 'desc' }, { title: 'B' }).description).toBe('desc')
    })
    it('deep-merge de og sin perder keys anteriores', () => {
        const result = mergeMetadata(
            { og: { title: 'A', image: 'img.png' } },
            { og: { title: 'B' } }
        )
        expect(result.og?.title).toBe('B')
        expect(result.og?.image).toBe('img.png')
    })
    it('deep-merge de twitter sin perder keys anteriores', () => {
        const result = mergeMetadata(
            { twitter: { card: 'summary', creator: '@user' } },
            { twitter: { card: 'summary_large_image' } }
        )
        expect(result.twitter?.card).toBe('summary_large_image')
        expect(result.twitter?.creator).toBe('@user')
    })
    it('ignora sources null y undefined', () => {
        expect(mergeMetadata(null, { title: 'A' }, undefined).title).toBe('A')
    })
})

describe('resolveMetadata', () => {
    it('usa metadata estático cuando no hay generateMetadata', async () => {
        const mod = { metadata: { title: 'Static' } }
        const ctx = { params: {}, request: new Request('http://x'), loaderData: null }
        const result = await resolveMetadata(mod as any, ctx)
        expect(result.metadata.title).toBe('Static')
    })
    it('llama generateMetadata cuando existe', async () => {
        const generate = vi.fn().mockResolvedValue({ title: 'Dynamic' })
        const mod = { generateMetadata: generate }
        const ctx = { params: {}, request: new Request('http://x'), loaderData: null }
        const result = await resolveMetadata(mod as any, ctx)
        expect(result.metadata.title).toBe('Dynamic')
        expect(generate).toHaveBeenCalledWith(ctx)
    })
})