const queryRegistry = new Map<string, (...args: unknown[]) => Promise<unknown>>()

type Executor = <A extends unknown[], R>(
  key: string,
  name: string,
  args: A,
  fn: (...args: A) => Promise<R>
) => Promise<R>

let executeQuery: Executor = <A extends unknown[], R>(
  _key: string,
  _name: string,
  args: A,
  fn: (...args: A) => Promise<R>
): Promise<R> => fn(...args)

export function setQueryExecutor(fn: Executor): void {
  executeQuery = fn
}

export function query<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  name: string
): (...args: A) => Promise<R> {
  queryRegistry.set(name, fn as (...args: unknown[]) => Promise<unknown>)

  return (...args: A): Promise<R> => {
    const key = `${name}:${JSON.stringify(args)}`
    return executeQuery(key, name, args, fn)
  }
}

export function getQueryRegistry(): Map<string, (...args: unknown[]) => Promise<unknown>> {
  return queryRegistry
}
