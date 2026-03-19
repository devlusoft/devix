export const HANDLER_BRAND = '__devix_handler__' as const

export interface DevixHandler<TBody = undefined, TReturn = unknown> {
    readonly [HANDLER_BRAND]: true
    readonly fn: (...args: any[]) => any
    readonly __body: TBody
    readonly __return: TReturn
}

type ExtractBody<TFn> = TFn extends (body: infer B) => any ? B : undefined

export function createHandler<TFn extends (...args: any[]) => any>(
    fn: TFn,
): DevixHandler<ExtractBody<TFn>, Awaited<ReturnType<TFn>>> {
    return {[HANDLER_BRAND]: true, fn} as unknown as DevixHandler<ExtractBody<TFn>, Awaited<ReturnType<TFn>>>
}
