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
}

export type LoaderFunction<TData = unknown, TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<TData> | TData
export type GuardFunction<TParams = Record<string, string>> = (ctx: LoaderContext<TParams>) => Promise<string | null> | string | null
