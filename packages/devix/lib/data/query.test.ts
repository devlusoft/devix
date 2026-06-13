import { sharedConfig } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './query'

type SharedConfigClient = typeof sharedConfig & {
  has?: (id: string) => boolean
  load?: (id: string) => unknown
}

type HydrationRegistry = { r: Record<string, unknown> }

function getClientConfig(): SharedConfigClient {
  return sharedConfig as SharedConfigClient
}

function getHY(): HydrationRegistry {
  return (globalThis as unknown as { _$HY?: HydrationRegistry })._$HY ?? { r: {} }
}

describe('query', () => {
  beforeEach(() => {
    const cfg = getClientConfig()
    cfg.context = undefined
    cfg.has = undefined
    cfg.load = undefined
    vi.stubGlobal('_$HY', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('executes and serializes on the server', async () => {
    const fn = vi.fn(async (id: string) => ({ id, name: 'Alice' }))
    const getUser = query(fn, 'getUser')

    const serialized: Record<string, unknown> = {}
    getClientConfig().context = {
      async: true,
      noHydrate: false,
      serialize: (key: string, value: unknown) => {
        serialized[key] = value
      },
    } as unknown as NonNullable<typeof sharedConfig.context>

    const result = await getUser('1')

    expect(fn).toHaveBeenCalledWith('1')
    expect(result).toEqual({ id: '1', name: 'Alice' })
    expect(Object.keys(serialized)).toHaveLength(1)
  })

  it('returns hydrated data on the client without executing fn', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('_$HY', { r: { 'devix:query:getUser:["1"]': { id: '1', name: 'Bob' } } })
    const cfg = getClientConfig()
    cfg.has = (id: string) => id in getHY().r
    cfg.load = (id: string) => getHY().r[id]

    const getUser = query(undefined, 'getUser')
    const result = await getUser('1')

    expect(result).toEqual({ id: '1', name: 'Bob' })
  })

  it('throws on the client when data is not hydrated', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('_$HY', { r: {} })
    const cfg = getClientConfig()
    cfg.has = (id: string) => id in getHY().r
    cfg.load = (id: string) => getHY().r[id]

    const getUser = query(undefined, 'getUser')

    await expect(getUser('1')).rejects.toThrow('can only run on the server')
  })
})
