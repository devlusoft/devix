import { getRequestEvent } from './request-context.js'
import { registerServerFn } from './server-registry.js'
import { clientTransport } from './transport.js'
import { buildQueryKey } from './query-client.js'

type QueryFn<P extends unknown[], R> = (...args: P) => R | Promise<R>

export function query<P extends unknown[], R>(
  fn: QueryFn<P, R>,
  name: string,
): (...args: P) => Promise<R> {
  registerServerFn({
    type: 'query',
    id: `query:${name}`,
    fn: fn as (...args: unknown[]) => unknown,
  })

  return async (...args: P): Promise<R> => {
    const key = buildQueryKey(name, args as unknown[])
    const event = getRequestEvent()

    if (typeof window === 'undefined') {
      const result = await fn(...args)
      if (event?.queryHydration) {
        event.queryHydration.set(key, result === undefined ? null : result)
      }
      return result
    }

    const hydration = (window as { __DEVIX_QUERIES__?: Record<string, unknown> })
      .__DEVIX_QUERIES__?.[key]
    if (hydration !== undefined) {
      return (hydration === null ? undefined : hydration) as R
    }

    return clientTransport.current(
      `query:${name}`,
      args as unknown[],
    ) as Promise<R>
  }
}