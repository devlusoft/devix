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

let currentEvent: RouterEvent | undefined

export function createRequestEvent(): RouterEvent {
  return {
    router: {
      cache: new Map(),
      data: {},
    },
  }
}

export function getRequestEvent(): RouterEvent | undefined {
  return currentEvent
}

export function runWithRequestEvent<T>(event: RouterEvent, fn: () => T): T {
  const previous = currentEvent
  currentEvent = event
  const globalWithSolid = globalThis as unknown as Record<
    symbol,
    { getStore: () => RouterEvent | undefined }
  >
  const previousSolid = globalWithSolid[SolidRequestContext]
  globalWithSolid[SolidRequestContext] = { getStore: () => currentEvent }
  try {
    return fn()
  } finally {
    currentEvent = previous
    globalWithSolid[SolidRequestContext] = previousSolid
  }
}
