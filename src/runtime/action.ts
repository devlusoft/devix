export type ActionCtx = { request: Request }

export function action<T extends (...args: any[]) => any>(fn: T): T {
    return fn
}
