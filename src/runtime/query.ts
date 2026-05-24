const REGISTRY_KEY = '__devix_query_registry__'
const EXECUTOR_KEY = '__devix_query_executor__'

type Executor = <A extends unknown[], R>(
  key: string,
  name: string,
  args: A,
  fn: (...args: A) => Promise<R>
) => Promise<R>

function getGlobalRegistry(): Map<string, (...args: unknown[]) => Promise<unknown>> {
  const g = globalThis as Record<string, unknown>
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Map()
  return g[REGISTRY_KEY] as Map<string, (...args: unknown[]) => Promise<unknown>>
}

function defaultExecutor<A extends unknown[], R>(
  _key: string,
  _name: string,
  args: A,
  fn: (...args: A) => Promise<R>
): Promise<R> {
  return fn(...args)
}

function getGlobalExecutor(): Executor {
  return ((globalThis as Record<string, unknown>)[EXECUTOR_KEY] as Executor | undefined) ?? defaultExecutor
}

export function setQueryExecutor(fn: Executor): void {
  ;(globalThis as Record<string, unknown>)[EXECUTOR_KEY] = fn
}

export function query<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  name: string
): (...args: A) => Promise<R> {
  getGlobalRegistry().set(name, fn as (...args: unknown[]) => Promise<unknown>)

  return (...args: A): Promise<R> => {
    const key = `${name}:${JSON.stringify(args)}`
    return getGlobalExecutor()(key, name, args, fn)
  }
}

export function getQueryRegistry(): Map<string, (...args: unknown[]) => Promise<unknown>> {
  return getGlobalRegistry()
}
