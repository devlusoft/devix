import {AsyncLocalStorage} from 'node:async_hooks'
import {setQueryExecutor} from '../runtime/query'
import {__setContextStore} from '../runtime/request-context'

export interface Store {
  cache: QueryCache
  request: Request
  responseHeaders: Headers
}

export class QueryCache {
  readonly #map = new Map<string, Promise<unknown>>()

  get(key: string): Promise<unknown> | undefined {
    return this.#map.get(key)
  }

  set(key: string, value: Promise<unknown>): void {
    this.#map.set(key, value)
  }

  entries(): IterableIterator<[string, Promise<unknown>]> {
    return this.#map.entries()
  }
}

const als = new AsyncLocalStorage<Store>()
__setContextStore(als)

export function getCurrentCache(): QueryCache | null {
  return als.getStore()?.cache ?? null
}

export function runWithQueryCache<T>(fn: () => T, cache?: QueryCache, request?: Request, responseHeaders?: Headers): T {
  const store: Store = {
    cache: cache ?? new QueryCache(),
    request: request ?? new Request('http://localhost'),
    responseHeaders: responseHeaders ?? new Headers(),
  }
  return als.run(store, fn)
}

export function initQueryCache(): void {
  setQueryExecutor(<A extends unknown[], R>(
    key: string,
    _name: string,
    _args: A,
    fn: (...args: A) => Promise<R>
  ): Promise<R> => {
    const cache = getCurrentCache()
    if (!cache) return fn(..._args)
    const existing = cache.get(key) as Promise<R> | undefined
    if (existing) return existing
    const p = fn(..._args)
    cache.set(key, p as Promise<unknown>)
    return p
  })
}
