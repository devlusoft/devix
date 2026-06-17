import { clientTransport } from './transport.js'

function hashKey(args: unknown[]): string {
  try {
    return JSON.stringify(args)
  } catch {
    return String(args)
  }
}

export function buildQueryKey(name: string, args: unknown[]): string {
  return `devix:query:${name}:${hashKey(args)}`
}

export const promiseCache = new Map<string, Promise<unknown>>()

export function clearPromiseCache(): void {
  console.log('[devix] clearPromiseCache: cleared', promiseCache.size, 'entries')
  promiseCache.clear()
}

export function clientQuery<P extends unknown[], R>(
  name: string,
): (...args: P) => Promise<R> {
  return (...args: P): Promise<R> => {
    const key = buildQueryKey(name, args as unknown[])
    const cached = promiseCache.get(key)
    if (cached) return cached as Promise<R>

    const promise = (async (): Promise<R> => {
      const hydration =
        typeof window !== 'undefined'
          ? (window as { __DEVIX_QUERIES__?: Record<string, unknown> })
              .__DEVIX_QUERIES__?.[key]
          : undefined
      if (hydration !== undefined) {
        return (hydration === null ? undefined : hydration) as R
      }
      return clientTransport.current(
        `query:${name}`,
        args as unknown[],
      ) as Promise<R>
    })()

    promiseCache.set(key, promise)
    return promise
  }
}