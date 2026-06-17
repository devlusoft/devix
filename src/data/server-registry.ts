export type ServerFnType = 'query' | 'action'

export interface ServerFnMeta {
  type: ServerFnType
  id: string
  fn: (...args: unknown[]) => unknown | Promise<unknown>
}

const REGISTRY_KEY = '__DEVIX_SERVER_FNS__'

function getRegistry(): Map<string, ServerFnMeta> {
  const g = globalThis as unknown as { [k: string]: Map<string, ServerFnMeta> | undefined }
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Map()
  return g[REGISTRY_KEY] as Map<string, ServerFnMeta>
}

export function registerServerFn(meta: ServerFnMeta): void {
  getRegistry().set(meta.id, meta)
}

export function getServerFn(id: string): ServerFnMeta | undefined {
  return getRegistry().get(id)
}

export function clearServerFns(): void {
  getRegistry().clear()
}

export function listServerFns(): ServerFnMeta[] {
  return [...getRegistry().values()]
}
