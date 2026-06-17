import { use, useEffect, useMemo, useReducer } from 'react'
import { subscribeToInvalidations } from './query-client'

export function useQuery<T>(fn: () => Promise<T> | T): T {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    return subscribeToInvalidations(forceUpdate)
  }, [forceUpdate])

  const value = useMemo(fn, [fn])
  if (value instanceof Promise) {
    return use(value)
  }
  return value
}