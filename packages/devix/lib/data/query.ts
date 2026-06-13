import { sharedConfig } from 'solid-js'

type QueryFn<P extends unknown[], R> = (...args: P) => R | Promise<R>

type SharedConfigContext = {
  async?: boolean
  noHydrate?: boolean
  serialize?: (id: string, p: unknown, wait?: boolean) => void
}

type SharedConfigClient = typeof sharedConfig & {
  has?: (id: string) => boolean
  load?: (id: string) => unknown
}

export function query<P extends unknown[], R>(
  fn: QueryFn<P, R> | undefined,
  name: string,
): (...args: P) => Promise<R> {
  return (async (...args: P) => {
    const key = `devix:query:${name}:${hashKey(args)}`
    const clientConfig = sharedConfig as SharedConfigClient

    if (typeof window !== 'undefined' && clientConfig.has?.(key) && clientConfig.load) {
      return clientConfig.load(key) as R
    }

    if (typeof window !== 'undefined') {
      throw new Error(`devix: query "${name}" can only run on the server`)
    }

    if (fn === undefined) {
      throw new Error(`devix: query "${name}" has no server implementation`)
    }

    const res = fn(...args)
    const ctx = sharedConfig.context as SharedConfigContext | undefined

    if (ctx?.async && !ctx.noHydrate) {
      ctx.serialize?.(key, res)
    }

    return res
  }) as (...args: P) => Promise<R>
}

function hashKey(args: unknown[]): string {
  try {
    return JSON.stringify(args)
  } catch {
    return String(args)
  }
}
