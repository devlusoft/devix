import {AsyncLocalStorage} from 'node:async_hooks'
import type {RouteContext} from '../runtime/api-context'

interface HandlerStore {
    request: Request
    ctx: RouteContext
}

const ALS_KEY = Symbol.for('@devlusoft/devix.handlerStore')
const g = globalThis as Record<symbol, unknown>
if (!g[ALS_KEY]) g[ALS_KEY] = new AsyncLocalStorage<HandlerStore>()
const storage = g[ALS_KEY] as AsyncLocalStorage<HandlerStore>

export function withHandlerStore<T>(store: HandlerStore, fn: () => T): T {
    return storage.run(store, fn)
}

function getStore(hookName: string): HandlerStore {
    const store = storage.getStore()
    if (!store) throw new Error(`[devix] ${hookName}() called outside of a request handler`)
    return store
}

export function useRequest(): Request {
    return getStore('useRequest').request
}

export function useCtx(): RouteContext {
    return getStore('useCtx').ctx
}

export function useParams(): Record<string, string> {
    return getStore('useParams').ctx.params
}
