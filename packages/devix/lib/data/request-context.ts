import { RequestContext as SolidRequestContext } from 'solid-js/web'

export type RouterEvent = {
  request: Request
  response: { headers: Headers }
  router: {
    cache: Map<string, unknown>
    data: Record<string, unknown>
    dataOnly?: boolean | string[]
  }
  serverOnly?: boolean
}

let currentEvent: RouterEvent | undefined

export function createRequestEvent(url: string): RouterEvent {
  return {
    request: new Request(`http://localhost${url}`),
    response: { headers: new Headers() },
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
