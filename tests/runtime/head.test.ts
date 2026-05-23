import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'solid-js/web'
import { buildHeadNodes } from '../../src/runtime/head'

let disposers: (() => void)[] = []

afterEach(() => {
    for (const d of disposers) d()
    disposers = []
})

function renderToHtml(metadata: any, viewport?: any): string {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = render(() => buildHeadNodes(metadata, viewport), container)
    disposers.push(() => { dispose(); document.body.removeChild(container) })
    return container.innerHTML
}

describe('buildHeadNodes', () => {
    it('renderiza title', () => {
        expect(renderToHtml({ title: 'Hello' })).toContain('<title>Hello</title>')
    })
    it('renderiza meta description', () => {
        expect(renderToHtml({ description: 'desc' })).toContain('name="description" content="desc"')
    })
    it('renderiza og tags', () => {
        const html = renderToHtml({ og: { title: 'OG', type: 'website' } })
        expect(html).toContain('property="og:title" content="OG"')
        expect(html).toContain('property="og:type" content="website"')
    })
    it('og:title cae al title base si no hay og.title', () => {
        expect(renderToHtml({ title: 'Base' })).toContain('property="og:title" content="Base"')
    })
    it('renderiza twitter card', () => {
        const html = renderToHtml({ twitter: { card: 'summary_large_image', creator: '@user' } })
        expect(html).toContain('name="twitter:card" content="summary_large_image"')
        expect(html).toContain('name="twitter:creator" content="@user"')
    })
    it('renderiza canonical', () => {
        expect(renderToHtml({ canonical: 'https://example.com/page' }))
            .toContain('rel="canonical" href="https://example.com/page"')
    })
    it('renderiza alternates con hrefLang', () => {
        const html = renderToHtml({ alternates: { en: 'https://example.com', es: 'https://es.example.com' } })
        expect(html).toContain('hreflang="en"')
        expect(html).toContain('hreflang="es"')
    })
    it('renderiza viewport meta', () => {
        const html = renderToHtml({}, { width: 'device-width', initialScale: 1 })
        expect(html).toContain('name="viewport"')
        expect(html).toContain('width=device-width')
        expect(html).toContain('initial-scale=1')
    })
    it('renderiza theme-color', () => {
        expect(renderToHtml({}, { themeColor: '#fff' })).toContain('name="theme-color" content="#fff"')
    })
})
