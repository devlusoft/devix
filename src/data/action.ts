import { registerServerFn } from './server-registry.js'
import type { RouterEvent } from './request-context.js'
import { clientTransport } from './transport.js'

const PLACEHOLDER_EVENT: RouterEvent = {
  cookies: () => ({}),
  pathname: '',
}

declare const __DEVIX_PROD__: boolean | undefined

export function devixAction<P extends unknown[], R>(
  id: string,
  fn: (...args: P) => R | Promise<R>,
): (...args: P) => Promise<R> {
  registerServerFn({
    type: 'action',
    id,
    fn: fn as (...args: unknown[]) => unknown,
  })
  return async (...args: P): Promise<R> => {
    if (import.meta.env?.SSR) {
      const { runWithRequestEvent, getRequestEvent } = await import('./request-context.js')
      const event = getRequestEvent() ?? PLACEHOLDER_EVENT
      return runWithRequestEvent(event, () => fn(...args))
    }
    return fn(...args)
  }
}

export function devixActionClient<R = unknown>(id: string): (...args: unknown[]) => Promise<R> {
  return (...args: unknown[]): Promise<R> =>
    clientTransport.current(id, args) as Promise<R>
}

export function action<P extends unknown[], R>(
  fn: (...args: P) => R | Promise<R>,
): (...args: P) => Promise<R> {
  if (typeof __DEVIX_PROD__ !== 'undefined' && __DEVIX_PROD__) {
    throw new Error(
      `action() must be assigned to a named or default export so the data transform can inject a stable id. ` +
        `Got: ${fn.name || '<anonymous>'}.`,
    )
  }
  return devixAction(`action:${fn.name || 'anonymous'}`, fn)
}
