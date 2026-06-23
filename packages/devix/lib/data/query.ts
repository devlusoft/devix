import { getRequestEvent } from './request-context.js'
import { registerServerFn } from './server-registry.js'
import { buildQueryKey } from './query-client.js'
import { decodeResponse } from '../utils/turbo-serializer.js'

type QueryFn<P extends unknown[], R> = (...args: P) => R | Promise<R>

/**
 * Cached client-side Promises keyed by `buildQueryKey` value. The same
 * `(name, args)` always returns the same Promise instance so React 19's
 * `use(promise)` can track it across renders. Cleared on
 * `invalidateQueries` so subsequent mounts re-fetch.
 */
const clientCache = new Map<string, Promise<unknown>>()

/**
 * Cache for the in-flight data endpoint fetch, keyed by pathname. Multiple
 * queries on the same page share one fetch.
 */
const dataEndpointCache = new Map<string, Promise<{ queryHydration?: Record<string, unknown> }>>()

export function clearClientQueryCache(): void {
    clientCache.clear()
    dataEndpointCache.clear()
}

async function fetchDataEndpoint(pathname: string): Promise<{ queryHydration?: Record<string, unknown> }> {
    let p = dataEndpointCache.get(pathname)
    if (!p) {
        p = (async () => {
            const res = await fetch(`/_devix/data${pathname}`, {
                headers: { Accept: 'application/octet-stream' },
            })
            if (!res.ok) {
                throw new Error(`Data endpoint returned ${res.status} for ${pathname}`)
            }
            return decodeResponse(res)
        })()
        dataEndpointCache.set(pathname, p)
    }
    return p
}

export function query<P extends unknown[], R>(
    fn: QueryFn<P, R>,
    name: string,
): (...args: P) => Promise<R> {
    registerServerFn({
        type: 'query',
        id: `query:${name}`,
        fn: fn as (...args: unknown[]) => unknown,
    })

    return (...args: P): Promise<R> => {
        const key = buildQueryKey(name, args as unknown[])

        if (typeof window === 'undefined') {
            // Server (SSR): run the query and store the result in the
            // request-scoped hydration map. The server then streams the
            // map to the client inside the HTML.
            return (async () => {
                const event = getRequestEvent()
                const result = await fn(...args)
                if (event?.queryHydration) {
                    event.queryHydration.set(key, result === undefined ? null : result)
                }
                return result as R
            })()
        }

        // Client: same Promise across calls with same (name, args).
        const cached = clientCache.get(key) as Promise<R> | undefined
        if (cached) return cached

        const promise = (async (): Promise<R> => {
            // 1) Try the SSR-hydrated global first (cold start). The
            //    server streamed it into the HTML <script>.
            const w = window as { __DEVIX_QUERIES__?: Record<string, unknown> }
            const hydration = w.__DEVIX_QUERIES__?.[key]
            if (hydration !== undefined) {
                return (hydration === null ? undefined : hydration) as R
            }

            // 2) Fall back to the data endpoint (client-side navigation).
            //    The endpoint returns the full page queryHydration; we
            //    extract just our key.
            const pathname = window.location.pathname
            const data = await fetchDataEndpoint(pathname)
            const value = data.queryHydration?.[key]
            if (value === undefined) {
                throw new Error(
                    `Query "${name}" with args ${JSON.stringify(args)} not found in data endpoint response for ${pathname}`,
                )
            }
            return (value === null ? undefined : value) as R
        })()

        clientCache.set(key, promise)
        return promise
    }
}
