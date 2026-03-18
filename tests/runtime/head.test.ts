import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildHeadNodes } from '../../src/runtime/head'

function render(metadata: any, viewport?: any) {
    return renderToStaticMarkup(buildHeadNodes(metadata, viewport) as any)
}

describe('buildHeadNodes', () => {
    it('renderiza title', () => {
        expect(render({ title: 'Hello' })).toContain('<title>Hello</title>')
    })
    it('renderiza meta description', () => {
        expect(render({ description: 'desc' })).toContain('name="description" content="desc"')
    })
    it('renderiza og tags', () => {
        const html = render({ og: { title: 'OG', type: 'website' } })
        expect(html).toContain('property="og:title" content="OG"')
        expect(html).toContain('property="og:type" content="website"')
    })
    it('og:title cae al title base si no hay og.title', () => {
        expect(render({ title: 'Base' })).toContain('property="og:title" content="Base"')
    })
    it('renderiza twitter card', () => {
        const html = render({ twitter: { card: 'summary_large_image', creator: '@user' } })
        expect(html).toContain('name="twitter:card" content="summary_large_image"')
        expect(html).toContain('name="twitter:creator" content="@user"')
    })
    it('renderiza canonical', () => {
        expect(render({ canonical: 'https://example.com/page' }))
            .toContain('rel="canonical" href="https://example.com/page"')
    })
    it('renderiza alternates con hrefLang', () => {
        const html = render({ alternates: { en: 'https://example.com', es: 'https://es.example.com' } })
        expect(html).toContain('hrefLang="en"')
        expect(html).toContain('hrefLang="es"')
    })
    it('renderiza viewport meta', () => {
        const html = render({}, { width: 'device-width', initialScale: 1 })
        expect(html).toContain('name="viewport"')
        expect(html).toContain('width=device-width')
        expect(html).toContain('initial-scale=1')
    })
    it('renderiza theme-color', () => {
        expect(render({}, { themeColor: '#fff' })).toContain('name="theme-color" content="#fff"')
    })
})