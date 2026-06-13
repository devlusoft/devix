import { AsyncLocalStorage } from 'node:async_hooks'
import { RequestContext as SolidRequestContext } from 'solid-js/web'

export type RouterEvent = {
  router: {
    cache: Map<string, unknown>
    data: Record<string, unknown>
    dataOnly?: unknown
  }
  serverOnly?: boolean
  request?: Request
}

let als: AsyncLocalStorage<RouterEvent> | undefined

declare global {
  // eslint-disable-next-line no-var
  var __DEVIX_REQUEST_ALS__: AsyncLocalStorage<RouterEvent> | undefined
}

function getALS(): AsyncLocalStorage<RouterEvent> {
  if (!als) {
    if (!globalThis.__DEVIX_REQUEST_ALS__) {
      globalThis.__DEVIX_REQUEST_ALS__ = new AsyncLocalStorage<RouterEvent>()
    }
    als = globalThis.__DEVIX_REQUEST_ALS__
  }
  return als
}

function getSolidRequestContext(): typeof SolidRequestContext {
  return SolidRequestContext
}

export function createRequestEvent(): RouterEvent {
  return {
    router: {
      cache: new Map(),
      data: {},
    },
  }
}

export function getRequestEvent(): RouterEvent | undefined {
  const als = getALS()
  return als.getStore()
}

export function runWithRequestEvent<T>(event: RouterEvent, fn: () => T): T {
  const als = getALS()
  const globalWithSolid = globalThis as unknown as Record<symbol, AsyncLocalStorage<RouterEvent>>
  const previous = globalWithSolid[getSolidRequestContext()]
  globalWithSolid[getSolidRequestContext()] = als
  als.enterWith(event)
  try {
    return fn()
  } finally {
    globalWithSolid[getSolidRequestContext()] = previous
  }
}
