import type {Component} from "solid-js";
import {LoaderContext, Metadata, Viewport} from "../types";
import type {Redirect, RouteError} from "../utils/response";

export interface PageProps<TParams = Record<string, string>> {
    params: TParams
    url: string
    guardData: <T>() => T
}

export interface LayoutProps<TParams = Record<string, string>> {
    children: any
    params: TParams
    guardData: <T>() => T
}

export interface ErrorProps {
    statusCode: number
    message?: string
    code?: string
    headers?: Record<string, string>
    data?: unknown
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

interface BaseModule<TParams> {
    guard?: (ctx: LoaderContext<TParams>) => Promise<string | Redirect | RouteError | Record<string, unknown> | null> | string | Redirect | RouteError | Record<string, unknown> | null
    metadata?: Metadata
    generateMetadata?: (ctx: LoaderContext<TParams>) => Promise<Metadata> | Metadata
    viewport?: Viewport
    generateViewport?: (ctx: LoaderContext<TParams>) => Promise<Viewport> | Viewport
    headers?: Record<string, string>
}

export interface PageModule<TParams = Record<string, string>>
    extends BaseModule<TParams> {
    default: Component<PageProps<TParams>>
    generateStaticParams?: () => Promise<Record<string, string>[]> | Record<string, string>[]
}

export interface LayoutModule<TParams = Record<string, string>>
    extends BaseModule<TParams> {
    default: Component<LayoutProps<TParams>>
    lang?: string
    generateLang?: (ctx: LoaderContext<TParams>) => Promise<string> | string
}