import { getRequestEvent, runWithRequestEvent } from './request-context'
import { registerServerFn } from './server-registry'
import { clientTransport } from './transport'

type ActionFn<P extends unknown[], R> = (...args: P) => R | Promise<R>

export function action<P extends unknown[], R>(fn: ActionFn<P, R>): (...args: P) => Promise<R> {
  if (isProduction()) {
    throw new Error(
      'devix: action() must be assigned directly to a named or default export so the compiler can inject a stable id. ' +
        'Use `export const myAction = action(async (...) => ...)` instead.',
    )
  }
  return devixAction(`action:${fn.name || 'anonymous'}`, fn)
}

function isProduction(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
}

export function devixAction<P extends unknown[], R>(
  id: string,
  fn: ActionFn<P, R>,
): (...args: P) => Promise<R> {
  registerServerFn(id, 'action', fn as (...args: unknown[]) => unknown)

  return async (...args: P) => {
    if (typeof window === 'undefined') {
      const event = getRequestEvent() ?? createStandaloneEvent()
      return runWithRequestEvent(event, () => fn(...args))
    }

    return clientTransport.current<R>(id, args as unknown[])
  }
}

export function devixActionClient<P extends unknown[], R>(id: string): (...args: P) => Promise<R> {
  return async (...args: P) => {
    return clientTransport.current<R>(id, args as unknown[])
  }
}

function createStandaloneEvent() {
  return {
    request: new Request('http://localhost/'),
    response: { headers: new Headers() },
    router: {
      cache: new Map<string, unknown>(),
      data: {} as Record<string, unknown>,
    },
  }
}
