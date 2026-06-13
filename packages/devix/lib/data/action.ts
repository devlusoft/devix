import { getRequestEvent, runWithRequestEvent } from './request-context'
import { registerServerFn } from './server-registry'
import { clientTransport } from './transport'

type ServerFn = (...args: unknown[]) => unknown | Promise<unknown>

export function action<P extends unknown[], R>(
  fn: (...args: P) => R | Promise<R>,
  name: string,
): (...args: P) => Promise<R> {
  const id = `action:${name}`
  const serverFn = fn as unknown as ServerFn
  registerServerFn(serverFn, id)

  if (typeof window === 'undefined') {
    return (async (...args: P) => {
      const event = getRequestEvent() ?? createStandaloneEvent()
      return runWithRequestEvent(event, () => serverFn(...args) as Promise<R> | R)
    }) as (...args: P) => Promise<R>
  }

  return (async (...args: P) => clientTransport.current<R>(id, args as unknown[])) as (
    ...args: P
  ) => Promise<R>
}

function createStandaloneEvent() {
  return {
    router: {
      cache: new Map<string, unknown>(),
      data: {} as Record<string, unknown>,
    },
  }
}
