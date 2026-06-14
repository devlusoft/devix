import { sharedConfig } from 'solid-js'
import { registerServerFn } from './server-registry'
import { clientTransport } from './transport'

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
  fn: QueryFn<P, R>,
  name: string,
): (...args: P) => Promise<R> {
  registerServerFn(name, 'query', fn as (...args: unknown[]) => unknown)

  return async (...args: P) => {
    const key = `devix:query:${name}:${hashKey(args)}`
    const clientConfig = sharedConfig as SharedConfigClient

    if (typeof window !== 'undefined' && clientConfig.has?.(key) && clientConfig.load) {
      return clientConfig.load(key) as R
    }

    if (typeof window === 'undefined') {
      const res = fn(...args)
      const ctx = sharedConfig.context as SharedConfigContext | undefined

      if (ctx?.async && !ctx.noHydrate) {
        ctx.serialize?.(key, res)
      }

      return res
    }

    return clientTransport.current<R>(name, args as unknown[])
  }
}

function hashKey(args: unknown[]): string {
  try {
    return JSON.stringify(args)
  } catch {
    return String(args)
  }
}
