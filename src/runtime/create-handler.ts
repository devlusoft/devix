import type {RouteResult} from './api-context'

export const HANDLER_BRAND = '__devix_handler__' as const

export interface DevixHandler<TBody = undefined, TReturn = RouteResult> {
    readonly [HANDLER_BRAND]: true
    readonly fn: (...args: any[]) => any
    readonly __body?: TBody
    readonly __return?: TReturn
}

export function createHandler<TReturn extends RouteResult = RouteResult>(
    fn: () => Promise<TReturn> | TReturn,
): DevixHandler<undefined, TReturn>

export function createHandler<TBody, TReturn extends RouteResult = RouteResult>(
    fn: (body: TBody) => Promise<TReturn> | TReturn,
): DevixHandler<TBody, TReturn>

export function createHandler(fn: (...args: any[]) => any): DevixHandler<any, any> {
    return {[HANDLER_BRAND]: true, fn}
}
