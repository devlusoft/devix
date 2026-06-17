import { AsyncLocalStorage } from 'node:async_hooks'

export interface RouterEvent {
  cookies(): Record<string, string>
  pathname: string
}

const eventStore = new AsyncLocalStorage<RouterEvent>()

export function runWithRequestEvent<T>(event: RouterEvent, fn: () => T): T {
  return eventStore.run(event, fn)
}

export function getRequestEvent(): RouterEvent | undefined {
  return eventStore.getStore()
}
