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

import type {BackendClient} from './runtime/server-client'

export interface LoaderContext<TParams = Record<string, string>> {
    params: TParams
    request: Request
    guardData: unknown
    /**
     * Cliente para llamar a backends remotos configurados en `devix.config.ts`.
     * Bound al request actual — `prepare` recibe el `Request` del usuario para
     * leer cookies, sesión, etc.
     */
    $server: Record<string, BackendClient>
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
 * export async function guard({ request }: LoaderContext) {
 *   const session = await getSession(request)
 *   if (!session) return '/login'
 *   return session   // ← TS infiere Session
 * }
 * ```
 */
export type GuardFunction<TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<string | Redirect | object | null> | string | Redirect | object | null
