export const HANDLER_BRAND = '__devix_handler__' as const

export interface DevixHandler<TBody = undefined, TReturn = unknown> {
    readonly [HANDLER_BRAND]: true
    readonly fn: (...args: any[]) => any
    readonly __body?: TBody
    readonly __return?: TReturn
}

type HandlerFn<TBody> = [TBody] extends [undefined] ? () => any : (body: TBody) => any

export function createHandler<
    TBody = undefined,
    TFn extends HandlerFn<TBody> = HandlerFn<TBody>,
>(fn: TFn): DevixHandler<TBody, Awaited<ReturnType<TFn>>> {
    return {[HANDLER_BRAND]: true, fn}
}
