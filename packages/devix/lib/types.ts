export interface MetadataIcon {
    href: string
    rel?: string
    type?: string
    sizes?: string
}

export interface Metadata {
    title?: string
    description?: string
    keywords?: string[]
    og?: {
        title?: string
        description?: string
        image?: string
        type?: 'website' | 'article' | 'product'
        url?: string
    }
    twitter?: {
        card?: 'summary' | 'summary_large_image'
        title?: string
        description?: string
        image?: string
        creator?: string
    }
    canonical?: string
    robots?: string
    alternates?: Record<string, string>
    icons?: string | MetadataIcon | MetadataIcon[]
}

export interface Viewport {
    width?: string | number
    initialScale?: number
    maximumScale?: number
    userScalable?: boolean
    themeColor?: string
}

/**
 * @deprecated since 0.9.0-alpha.2. `LoaderContext` is tied to the route-level `loader()` API, which is being phased out in favor of `query()` + `useQuery()`. The replacement uses `getRequestEvent()` for request context (cookies, pathname) instead of receiving it as an argument. See `docs/queries.md`.
 */
export interface LoaderContext<TParams = Record<string, string>> {
    params: TParams
    request: Request
    guardData: unknown
}

import type { Redirect } from './utils/response'

/**
 * @deprecated since 0.9.0-alpha.2. Define your data fetcher with `query(fn, name)` instead and read it with `useQuery()`. Loaders were attached to the route module; queries are reusable, deduped by `(name, args)`, and not coupled to the route tree. See `docs/queries.md`.
 */
export type LoaderFunction<TData = unknown, TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<TData | Redirect | void> | TData | Redirect | void

/**
 * Tipo público para guards. Útil para helpers reutilizables donde el tipo
 * concreto del retorno no importa.
 *
 * ⚠️ No anotes tu guard con este tipo si quieres inferencia de `guardData`.
 * El retorno `object` aplana el tipo concreto. Forma recomendada:
 *
 * ```ts
 * export async function guard({ request }: LoaderContext) {
 *   const session = await getSession(request)
 *   if (!session) return '/login'
 *   return session   // ← TS infiere Session
 * }
 * ```
 */
export type GuardFunction<TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<string | Redirect | object | null> | string | Redirect | object | null

type GuardData<TGuard> =
    TGuard extends (...args: any[]) => infer R
    ? Exclude<Awaited<R>, string | Redirect | null | undefined>
    : unknown

export type LoaderContextWithGuard<
    TGuard extends GuardFunction | undefined = undefined,
    TParams = Record<string, string>,
> = LoaderContext<TParams> & { guardData: GuardData<TGuard> }
