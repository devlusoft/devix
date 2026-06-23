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


export interface GuardContext<TParams = Record<string, string>> {
    params: TParams
    request: Request
    guardData: unknown
}

import type { Redirect } from './utils/response'

/**
 * Tipo público para guards. Útil para helpers reutilizables donde el tipo
 * concreto del retorno no importa.
 *
 * ⚠️ No anotes tu guard con este tipo si quieres inferencia de `guardData`.
 * El retorno `object` aplana el tipo concreto. Forma recomendada:
 *
 * ```ts
 * export async function guard({ request }: GuardContext) {
 *   const session = await getSession(request)
 *   if (!session) return '/login'
 *   return session   // ← TS infiere Session
 * }
 * ```
 */
export type GuardFunction<TParams = Record<string, string>> = (ctx: GuardContext<TParams>) => Promise<string | Redirect | object | null> | string | Redirect | object | null

type GuardData<TGuard> =
    TGuard extends (...args: any[]) => infer R
    ? Exclude<Awaited<R>, string | Redirect | null | undefined>
    : unknown

export type GuardContextWithGuard<
    TGuard extends GuardFunction | undefined = undefined,
    TParams = Record<string, string>,
> = GuardContext<TParams> & { guardData: GuardData<TGuard> }
