export const HANDLER_BRAND = '__devix_handler__' as const

export interface DevixHandler<TBody = undefined, TReturn = unknown> {
    readonly [HANDLER_BRAND]: true
    readonly fn: (...args: any[]) => any
    readonly __body?: TBody
    readonly __return?: TReturn
}

declare const UNSET: unique symbol
type Unset = typeof UNSET

type ExtractBody<TFn> = TFn extends (body: infer B) => any ? B : undefined

type FnConstraint<TBody> = [TBody] extends [Unset]
    ? (...args: any[]) => any
    : (body: TBody) => unknown

type ResolveBody<TBody, TFn> = [TBody] extends [Unset] ? ExtractBody<TFn> : TBody

export function createHandler<
    TBody = Unset,
    TFn extends FnConstraint<TBody> = FnConstraint<TBody>,
>(fn: TFn): DevixHandler<ResolveBody<TBody, TFn>, Awaited<ReturnType<TFn>>> {
    return {[HANDLER_BRAND]: true, fn}
}
