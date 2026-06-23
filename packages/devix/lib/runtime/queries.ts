import { use, useEffect, useReducer } from 'react'
import { subscribeToInvalidations } from './query-client'

/**
 * Subscribe to a query's Promise and return its resolved value.
 *
 * The Promise is expected to be stable across renders — the caller must
 * cache it, typically via `query(fn, name)` from `@devlusoft/devix/data`
 * which caches Promises by `(name, args)`. This lets React 19's
 * `use(promise)` track the same Promise across renders.
 *
 * Wrap the consumer in `<Suspense fallback={...}>` — the Promise may be
 * pending on first mount (e.g. while the data endpoint is fetched) and
 * the fallback will be shown until it resolves.
 */
export function useQuery<T>(promise: Promise<T>): T {
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

    useEffect(() => {
        return subscribeToInvalidations(forceUpdate)
    }, [forceUpdate])

    return use(promise)
}
