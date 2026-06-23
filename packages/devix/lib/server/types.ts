import type React from "react";
import {GuardContext, Metadata, Viewport} from "../types";
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

interface BaseModule<TParams = Record<string, string>> {
    guard?: (ctx: GuardContext<TParams>) => Promise<string | Redirect | RouteError | Record<string, unknown> | null> | string | Redirect | RouteError | Record<string, unknown> | null
    metadata?: Metadata
    generateMetadata?: (ctx: GuardContext<TParams> & { loaderData: unknown }) => Promise<Metadata> | Metadata
    viewport?: Viewport
    generateViewport?: (ctx: GuardContext<TParams>) => Promise<Viewport> | Viewport
    headers?: Record<string, string>
}

export interface PageModule<TParams = Record<string, string>>
    extends BaseModule<TParams> {
    default: React.ComponentType<PageProps<unknown, TParams>>
    generateStaticParams?: () => Promise<Record<string, string>[]> | Record<string, string>[]
}

export interface LayoutModule<TParams = Record<string, string>>
    extends BaseModule<TParams> {
    default: React.ComponentType<LayoutProps<unknown, TParams>>
    lang?: string
    generateLang?: (ctx: GuardContext<TParams> & { loaderData: unknown }) => Promise<string> | string
}