import {createResource, type ResourceReturn} from 'solid-js'

export function createAsync<T>(
  fn: () => Promise<T> | T
): () => T | undefined {
  const [value]: ResourceReturn<T> = createResource<T>(async () => {
    return await fn()
  })
  return () => value()
}
