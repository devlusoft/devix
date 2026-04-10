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

export interface LoaderContext<TParams = Record<string, string>> {
    params: TParams
    request: Request
    guardData: unknown
}

import type { Redirect } from './utils/response'

export type LoaderFunction<TData = unknown, TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<TData | Redirect | void> | TData | Redirect | void
export type GuardFunction<TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<string | Redirect | object | null> | string | Redirect | object | null

type GuardData<TGuard> =
    TGuard extends (...args: any[]) => infer R
    ? Exclude<Awaited<R>, string | Redirect | null | undefined>
    : unknown

export type LoaderContextWithGuard<
    TGuard extends GuardFunction | undefined = undefined,
    TParams = Record<string, string>,
> = LoaderContext<TParams> & { guardData: GuardData<TGuard> }
