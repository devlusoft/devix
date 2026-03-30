import {describe, it, expect, vi} from 'vitest'
import {getStaticRoutes} from '../../src/server/render'
import type {PageGlob} from '../../src/server/types'

const PAGES_DIR = 'app/pages'

function makeGlob(pages: Record<string, () => Promise<unknown>>, layoutKeys: string[] = []): PageGlob {
    const layouts: Record<string, () => Promise<unknown>> = {}
    for (const key of layoutKeys) {
        layouts[key] = vi.fn().mockResolvedValue({default: () => null})
    }
    return {pages, layouts, pagesDir: PAGES_DIR}
}

describe('getStaticRoutes', () => {
    it('includes static routes', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: vi.fn().mockResolvedValue({default: () => null}),
            [`${PAGES_DIR}/about.tsx`]: vi.fn().mockResolvedValue({default: () => null}),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toContain('/')
        expect(urls).toContain('/about')
    })

    it('skips dynamic routes without generateStaticParams', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/blog/[slug].tsx`]: vi.fn().mockResolvedValue({default: () => null}),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toHaveLength(0)
    })

    it('expands dynamic routes using generateStaticParams', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/blog/[slug].tsx`]: vi.fn().mockResolvedValue({
                default: () => null,
                generateStaticParams: vi.fn().mockResolvedValue([
                    {slug: 'hello-world'},
                    {slug: 'second-post'},
                ]),
            }),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toEqual(['/blog/hello-world', '/blog/second-post'])
    })

    it('handles multiple params in a single dynamic route', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/[category]/[slug].tsx`]: vi.fn().mockResolvedValue({
                default: () => null,
                generateStaticParams: vi.fn().mockResolvedValue([
                    {category: 'news', slug: 'breaking'},
                    {category: 'tech', slug: 'ai-update'},
                ]),
            }),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toContain('/news/breaking')
        expect(urls).toContain('/tech/ai-update')
    })

    it('URL-encodes param values with special characters', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/blog/[slug].tsx`]: vi.fn().mockResolvedValue({
                default: () => null,
                generateStaticParams: vi.fn().mockResolvedValue([
                    {slug: 'hello world'},
                ]),
            }),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toContain('/blog/hello%20world')
    })

    it('returns empty array when generateStaticParams returns empty list', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/blog/[slug].tsx`]: vi.fn().mockResolvedValue({
                default: () => null,
                generateStaticParams: vi.fn().mockResolvedValue([]),
            }),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toHaveLength(0)
    })

    it('mixes static and expanded dynamic routes', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/index.tsx`]: vi.fn().mockResolvedValue({default: () => null}),
            [`${PAGES_DIR}/about.tsx`]: vi.fn().mockResolvedValue({default: () => null}),
            [`${PAGES_DIR}/blog/[slug].tsx`]: vi.fn().mockResolvedValue({
                default: () => null,
                generateStaticParams: vi.fn().mockResolvedValue([
                    {slug: 'post-1'},
                    {slug: 'post-2'},
                ]),
            }),
            [`${PAGES_DIR}/docs/[id].tsx`]: vi.fn().mockResolvedValue({default: () => null}),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toContain('/')
        expect(urls).toContain('/about')
        expect(urls).toContain('/blog/post-1')
        expect(urls).toContain('/blog/post-2')
        expect(urls).not.toContain('/docs/:id')
        expect(urls).toHaveLength(4)
    })

    it('supports synchronous generateStaticParams', async () => {
        const glob = makeGlob({
            [`${PAGES_DIR}/item/[id].tsx`]: vi.fn().mockResolvedValue({
                default: () => null,
                generateStaticParams: () => [{id: '1'}, {id: '2'}],
            }),
        })
        const urls = await getStaticRoutes(glob)
        expect(urls).toEqual(['/item/1', '/item/2'])
    })
})
