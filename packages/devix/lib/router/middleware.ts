import { type BuildManifestResult, findRouteForUrl } from './manifest'

export interface MiddlewareContext {
  request: Request
  params: Record<string, string>
}

export type MiddlewareResult = Response | string | null | undefined

export type MiddlewareModule = {
  default?: (ctx: MiddlewareContext) => MiddlewareResult | Promise<MiddlewareResult>
}

export type LoadMiddlewareFn = (file: string) => Promise<MiddlewareModule>

export async function runRouteMiddlewares(opts: {
  url: string
  manifest: BuildManifestResult
  request: Request
  loadMiddleware: LoadMiddlewareFn
}): Promise<Response | string | null> {
  const match = findRouteForUrl(opts.manifest.routes, opts.url)
  if (!match) return null

  for (const middlewareFile of match.leaf.middlewares) {
    const mod = await opts.loadMiddleware(middlewareFile)
    if (typeof mod.default !== 'function') continue

    const ctx: MiddlewareContext = {
      request: opts.request,
      params: match.params,
    }

    const result = await mod.default(ctx)
    if (result) return result
  }

  return null
}
