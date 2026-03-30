import type React from "react";
import {LoaderContext, Metadata, Viewport} from "../types";
import type {Redirect, RouteError} from "../utils/response";

type InferLoaderData<T> = T extends (...args: any[]) => infer R
    ? [Awaited<R>] extends [void | undefined | Redirect] ? undefined : Exclude<Awaited<R>, Redirect>
    : T

type IsParams<T> = [T] extends [Record<string, string>] ? true : false

export interface PageProps<TDataOrParams = unknown, TParams = Record<string, string>> {
    data: IsParams<TDataOrParams> extends true ? unknown : InferLoaderData<TDataOrParams>
    params: IsParams<TDataOrParams> extends true
        ? TDataOrParams extends Record<string, string> ? TDataOrParams : Record<string, string>
        : TParams
    url: string
}

export interface LayoutProps<TDataOrParams = unknown, TParams = Record<string, string>> {
    children: React.ReactNode
    data: IsParams<TDataOrParams> extends true ? unknown : InferLoaderData<TDataOrParams>
    params: IsParams<TDataOrParams> extends true
        ? TDataOrParams extends Record<string, string> ? TDataOrParams : Record<string, string>
        : TParams
}

export interface ErrorProps {
    statusCode: number
    message?: string
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

interface BaseModule<TData, TParams> {
    loader?: (ctx: LoaderContext<TParams>) => Promise<TData | Redirect | void> | TData | Redirect | void
    guard?: (ctx: LoaderContext<TParams>) => Promise<string | Redirect | RouteError | Record<string, unknown> | null> | string | Redirect | RouteError | Record<string, unknown> | null
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