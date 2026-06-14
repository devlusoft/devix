export type ServerFnType = 'query' | 'action'

export type ServerFnMeta = {
  id: string
  type: ServerFnType
  fn: (...args: unknown[]) => unknown
}

const registry =
  ((globalThis as Record<string, unknown>).__DEVIX_SERVER_FNS__ as
    | Map<string, ServerFnMeta>
    | undefined) ?? new Map<string, ServerFnMeta>()
;(globalThis as Record<string, unknown>).__DEVIX_SERVER_FNS__ = registry

export function registerServerFn(
  id: string,
  type: ServerFnType,
  fn: (...args: unknown[]) => unknown,
): void {
  registry.set(id, { id, type, fn })
}

export function getServerFn(id: string): ServerFnMeta {
  const meta = registry.get(id)
  if (!meta) {
    throw new Error(`devix: unknown server function "${id}"`)
  }
  return meta
}

export function clearServerFns(): void {
  registry.clear()
}

export function listServerFns(): string[] {
  return Array.from(registry.keys())
}
