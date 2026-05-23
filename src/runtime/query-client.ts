import {setQueryExecutor} from './query'
import { decodeTurboResponse, collectTurbo } from './turbo-client'

const clientCache = new Map<string, unknown>()

export function initClientQueryCache(): void {
  setQueryExecutor(<A extends unknown[], R>(
    key: string,
    name: string,
    args: A,
    _fn: (...args: A) => Promise<R>
  ): Promise<R> => {
    const cached = clientCache.get(key)
    if (cached !== undefined) {
      return cached instanceof Promise ? cached as Promise<R> : Promise.resolve(cached as R)
    }
    return queryRpc(name, args) as Promise<R>
  })
}

export function hydrateClientCache(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    clientCache.set(key, value)
  }
}

async function queryRpc(name: string, args: unknown[]): Promise<unknown> {
  const body = await collectTurbo([{name, args}])
  const res = await fetch('/_devix/query', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-turbo'},
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`Query RPC failed (${res.status}): ${text}`)
  }
  const result: Record<string, unknown> = await decodeTurboResponse(res) as Record<string, unknown>
  return result[name]
}
