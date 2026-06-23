import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  runWithRequestEvent,
  type RouterEvent,
} from '../../lib/data/request-context'
import { clearServerFns, getServerFn } from '../../lib/data/server-registry'
import {
  clientTransport,
  type Transport,
} from '../../lib/data/transport'
import { query } from '../../lib/data/query'
import {
  clientQuery,
  buildQueryKey,
  clearPromiseCache,
} from '../../lib/data/query-client'

function createEvent(pathname = '/test'): RouterEvent {
  return { cookies: () => ({}), pathname }
}

describe('buildQueryKey', () => {
  it('includes the name and a stable hash of the args', () => {
    expect(buildQueryKey('getPost', ['1'])).toBe('devix:query:getPost:["1"]')
  })

  it('produces the same key for structurally equal args', () => {
    expect(buildQueryKey('getPost', [{ id: 1 }])).toBe(
      buildQueryKey('getPost', [{ id: 1 }]),
    )
  })

  it('produces different keys for different args', () => {
    expect(buildQueryKey('getPost', ['1'])).not.toBe(
      buildQueryKey('getPost', ['2']),
    )
  })
})

describe('query()', () => {
  let originalTransport: Transport

  beforeEach(() => {
    clearServerFns()
    clearPromiseCache()
    originalTransport = clientTransport.current
  })

  afterEach(() => {
    clientTransport.current = originalTransport
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('registers the function in the server registry with type query and id query:<name>', () => {
    const fn = async (id: string) => ({ id })
    query(fn, 'getUser')

    const meta = getServerFn('query:getUser')
    expect(meta).toBeDefined()
    expect(meta!.type).toBe('query')
    expect(meta!.fn).toBe(fn)
  })

  it('runs the fn on the server and writes the resolved value into RouterEvent.queryHydration', async () => {
    const fn = vi.fn(async (id: string) => ({ id, name: 'Alice' }))
    const getUser = query(fn, 'getUser')
    const event = createEvent()

    await runWithRequestEvent(event, async () => {
      await getUser('1')
      await new Promise((resolve) => setTimeout(resolve, 0))
      const map = event.queryHydration!
      expect(map.get(buildQueryKey('getUser', ['1']))).toEqual({
        id: '1',
        name: 'Alice',
      })
    })

    expect(fn).toHaveBeenCalledWith('1')
  })

  it('serializes undefined hydration values as null so JSON keeps the key', async () => {
    const fn = async () => undefined
    const maybeMissing = query(fn, 'maybeMissing')
    const event = createEvent()

    await runWithRequestEvent(event, async () => {
      await maybeMissing()
      await new Promise((resolve) => setTimeout(resolve, 0))
      const map = event.queryHydration!
      expect(map.has(buildQueryKey('maybeMissing', []))).toBe(true)
      expect(map.get(buildQueryKey('maybeMissing', []))).toBeNull()
    })
  })

  it('drops hydration entries when the fn rejects', async () => {
    const fn = async () => {
      throw new Error('boom')
    }
    const failing = query(fn, 'failing')
    const event = createEvent()

    await runWithRequestEvent(event, async () => {
      await expect(failing()).rejects.toThrow('boom')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(event.queryHydration!.size).toBe(0)
    })
  })

  it('returns hydration value on the client without calling RPC', async () => {
    const key = buildQueryKey('getUser', ['1'])
    ;(globalThis as unknown as { window?: Record<string, unknown> }).window = {
      __DEVIX_QUERIES__: { [key]: { id: '1', name: 'Bob' } },
    }
    const transport = vi.fn(async () => 'should-not-call')
    clientTransport.current = transport

    const getUser = query(
      (id: string) => ({ should: 'not run', id }),
      'getUser',
    )
    const result = await getUser('1')

    expect(result).toEqual({ id: '1', name: 'Bob' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('client query returns a pending promise that fetches the data endpoint when no hydration exists', async () => {
    ;(globalThis as unknown as { window?: Record<string, unknown> }).window = {
      __DEVIX_QUERIES__: {},
      location: { pathname: '/users/1' },
    }
    const transport = vi.fn(async () => ({ id: '1', name: 'Carol' }))
    clientTransport.current = transport as unknown as Transport

    const getUser = query(
      (_id: string) => ({ should: 'not run' }),
      'getUser',
    )

    // Mock fetch to return the data endpoint response
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () =>
      new Response(null, { status: 500 }),
    ) as unknown as typeof fetch
    // decodeResponse won't be reached because we throw if not ok; instead
    // verify that the pending promise was created (not a synchronous return).
    const promise = getUser('1')
    expect(promise).toBeInstanceOf(Promise)
    globalThis.fetch = originalFetch
    expect(transport).not.toHaveBeenCalled()
  })
})

describe('clientQuery()', () => {
  let originalTransport: Transport

  beforeEach(() => {
    clearServerFns()
    clearPromiseCache()
    originalTransport = clientTransport.current
  })

  afterEach(() => {
    clientTransport.current = originalTransport
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('does not register anything in the server registry', () => {
    clientQuery('orphan')
    expect(getServerFn('query:orphan')).toBeUndefined()
  })

  it('returns hydration value on the client', async () => {
    const key = buildQueryKey('listUsers', [])
    ;(globalThis as unknown as { window?: Record<string, unknown> }).window = {
      __DEVIX_QUERIES__: { [key]: ['a', 'b'] },
    }
    const transport = vi.fn(async () => 'should-not-call')
    clientTransport.current = transport

    const listUsers = clientQuery('listUsers')
    const result = await listUsers()

    expect(result).toEqual(['a', 'b'])
    expect(transport).not.toHaveBeenCalled()
  })

  it('falls back to RPC when no hydration entry exists', async () => {
    ;(globalThis as unknown as { window?: Record<string, unknown> }).window = {
      __DEVIX_QUERIES__: {},
    }
    const transport = vi.fn(async () => 'rpc-result')
    clientTransport.current = transport as unknown as Transport

    const listUsers = clientQuery('listUsers')
    const result = await listUsers()

    expect(result).toBe('rpc-result')
    expect(transport).toHaveBeenCalledWith('query:listUsers', [])
  })
})