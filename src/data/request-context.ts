const REQUEST_EVENT_KEY = '__DEVIX_REQUEST_EVENT__'

export interface RouterEvent {
  cookies(): Record<string, string>
  pathname: string
  queryHydration?: Map<string, unknown>
}

export function getRequestEvent(): RouterEvent | undefined {
  return (globalThis as Record<string, unknown>)[REQUEST_EVENT_KEY] as
    | RouterEvent
    | undefined
}

export async function runWithRequestEvent<T>(
  event: RouterEvent,
  fn: () => T | Promise<T>,
): Promise<T> {
  event.queryHydration ??= new Map<string, unknown>()
  const g = globalThis as Record<string, unknown>
  const previous = g[REQUEST_EVENT_KEY]
  g[REQUEST_EVENT_KEY] = event
  try {
    return await fn()
  } finally {
    g[REQUEST_EVENT_KEY] = previous
  }
}

export function createRequestEvent(pathname: string): RouterEvent {
  return {
    cookies: () => ({}),
    pathname,
    queryHydration: new Map<string, unknown>(),
  }
}