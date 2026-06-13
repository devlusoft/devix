type ServerFn = (...args: unknown[]) => unknown

const registry = new Map<string, ServerFn>()

export function registerServerFn<R extends (...args: unknown[]) => unknown>(fn: R, id: string): R {
  registry.set(id, fn as ServerFn)
  return fn
}

export function getServerFn(id: string): ServerFn {
  const fn = registry.get(id)
  if (!fn) {
    throw new Error(`devix: unknown server function "${id}"`)
  }
  return fn
}

export function clearServerFns(): void {
  registry.clear()
}
