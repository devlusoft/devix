import { describe, expect, it } from 'vitest'
import { buildManifest } from './manifest'
import { type MiddlewareContext, runRouteMiddlewares } from './middleware'

describe('runRouteMiddlewares', () => {
  it('returns null when no middlewares match', async () => {
    const { routes } = buildManifest({ files: ['index.tsx'] })
    const result = await runRouteMiddlewares({
      url: '/',
      manifest: { routes },
      request: new Request('http://localhost/'),
      loadMiddleware: async () => ({ default: () => null }),
    })
    expect(result).toBeNull()
  })

  it('returns redirect string from first matching middleware', async () => {
    const { routes } = buildManifest({
      files: ['middleware.ts', 'admin/middleware.ts', 'admin/index.tsx'],
    })
    const result = await runRouteMiddlewares({
      url: '/admin',
      manifest: { routes },
      request: new Request('http://localhost/admin'),
      loadMiddleware: async (file) =>
        file === 'admin/middleware.ts' ? { default: () => '/login' } : { default: () => null },
    })
    expect(result).toBe('/login')
  })

  it('runs middlewares outer to inner and stops on first result', async () => {
    const { routes } = buildManifest({
      files: ['middleware.ts', 'admin/middleware.ts', 'admin/index.tsx'],
    })
    const order: string[] = []
    const result = await runRouteMiddlewares({
      url: '/admin',
      manifest: { routes },
      request: new Request('http://localhost/admin'),
      loadMiddleware: async (file) => ({
        default: () => {
          order.push(file)
          return file === 'middleware.ts' ? '/blocked' : null
        },
      }),
    })
    expect(order).toEqual(['middleware.ts'])
    expect(result).toBe('/blocked')
  })

  it('returns Response as-is', async () => {
    const { routes } = buildManifest({ files: ['middleware.ts', 'admin/index.tsx'] })
    const response = new Response('unauthorized', { status: 401 })
    const result = await runRouteMiddlewares({
      url: '/admin',
      manifest: { routes },
      request: new Request('http://localhost/admin'),
      loadMiddleware: async () => ({ default: () => response }),
    })
    expect(result).toBe(response)
  })

  it('skips middleware modules without a default export', async () => {
    const { routes } = buildManifest({ files: ['middleware.ts', 'index.tsx'] })
    const result = await runRouteMiddlewares({
      url: '/',
      manifest: { routes },
      request: new Request('http://localhost/'),
      loadMiddleware: async () => ({}),
    })
    expect(result).toBeNull()
  })

  it('passes request and params to middleware', async () => {
    const { routes } = buildManifest({
      files: ['blog/[slug]/middleware.ts', 'blog/[slug]/index.tsx'],
    })
    let captured: MiddlewareContext = { request: new Request('http://localhost/'), params: {} }
    await runRouteMiddlewares({
      url: '/blog/hello',
      manifest: { routes },
      request: new Request('http://localhost/blog/hello'),
      loadMiddleware: async () => ({
        default: (c: MiddlewareContext) => {
          captured = { request: c.request, params: c.params }
          return null
        },
      }),
    })
    expect(captured.params).toEqual({ slug: 'hello' })
    expect(captured.request.url).toBe('http://localhost/blog/hello')
  })
})
