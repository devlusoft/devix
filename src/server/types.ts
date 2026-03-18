import type React from "react";
import {LoaderContext, Metadata, Viewport} from "../types";

export interface PageProps<TData = unknown, TParams = Record<string, string>> {
    data: TData
    params: TParams
    url: string
}

export interface LayoutProps<TData = unknown, TParams = Record<string, string>> {
    children: React.ReactNode
    data: TData
    params: TParams
}

export interface ErrorProps {
    statusCode: number
    message?: string
}

export interface PageGlob {
    pages: Record<string, () => Promise<unknown>>
    layouts: Record<string, () => Promise<unknown>>
    pagesDir: string
}

export interface ApiGlob {
    routes: Record<string, () => Promise<unknown>>
    middlewares: Record<string, () => Promise<unknown>>
    apiDir: string
}

interface BaseModule<TData, TParams> {
    loader?: (ctx: LoaderContext<TParams>) => Promise<TData> | TData
    guard?: (ctx: LoaderContext<TParams>) => Promise<string | null> | string | null
    metadata?: Metadata
    generateMetadata?: (ctx: LoaderContext<TParams> & { loaderData: TData }) => Promise<Metadata> | Metadata
    viewport?: Viewport
    generateViewport?: (ctx: LoaderContext<TParams>) => Promise<Viewport> | Viewport
    headers?: Record<string, string>
}

export interface PageModule<TData = unknown, TParams = Record<string, string>>
    extends BaseModule<TData, TParams> {
    default: React.ComponentType<PageProps<TData, TParams>>
    generateStaticParams?: () => Promise<Record<string, string>[]> | Record<string, string>[]
}

export interface LayoutModule<TData = unknown, TParams = Record<string, string>>
    extends BaseModule<TData, TParams> {
    default: React.ComponentType<LayoutProps<TData, TParams>>
    lang?: string
    generateLang?: (ctx: LoaderContext<TParams> & { loaderData: TData }) => Promise<string> | string
}