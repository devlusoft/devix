import { clearPromiseCache } from '../data/query-client'

type Listener = () => void

const listeners = new Set<Listener>()

export function invalidateQueries(_name?: string): void {
  console.log('[devix] invalidateQueries called')
  clearPromiseCache()
  for (const listener of listeners) listener()
}

export function subscribeToInvalidations(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}