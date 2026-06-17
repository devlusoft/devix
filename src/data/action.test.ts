import { describe, it, expect, beforeEach } from 'vitest'
import { action, devixAction, devixActionClient } from './action.js'
import { clearServerFns, getServerFn, listServerFns } from './server-registry.js'
import { clientTransport } from './transport.js'

describe('action', () => {
  beforeEach(() => {
    clearServerFns()
  })

  it('devixAction registers the fn in the registry', () => {
    const fn = async (n: number) => n * 2
    devixAction('action:test', fn)
    const meta = getServerFn('action:test')
    expect(meta).toBeDefined()
    expect(meta?.type).toBe('action')
    expect(meta?.fn).toBe(fn)
  })

  it('devixAction returns a callable that runs the fn', async () => {
    const fn = async (n: number) => n * 2
    const wrapped = devixAction('action:test', fn)
    const result = await wrapped(5)
    expect(result).toBe(10)
  })

  it('devixActionClient does NOT register in the registry', () => {
    devixActionClient('action:client')
    expect(getServerFn('action:client')).toBeUndefined()
    expect(listServerFns()).toHaveLength(0)
  })

  it('devixActionClient returns a callable that delegates to clientTransport', async () => {
    const calls: Array<[string, unknown[]]> = []
    const original = clientTransport.current
    clientTransport.current = async (id, args) => {
      calls.push([id, args])
      return 'rpc-result'
    }
    try {
      const fn = devixActionClient<unknown>('action:client')
      const result = await fn(1, 2, 3)
      expect(result).toBe('rpc-result')
      expect(calls).toEqual([['action:client', [1, 2, 3]]])
    } finally {
      clientTransport.current = original
    }
  })

  it('action() in dev uses fn.name as id', () => {
    function myAction() {
      return 42
    }
    action(myAction)
    expect(getServerFn('action:myAction')).toBeDefined()
  })

  it('action() throws when __DEVIX_PROD__ is true', () => {
    ;(globalThis as { __DEVIX_PROD__?: boolean }).__DEVIX_PROD__ = true
    try {
      expect(() => action(() => 42)).toThrow('action() must be assigned')
    } finally {
      delete (globalThis as { __DEVIX_PROD__?: boolean }).__DEVIX_PROD__
    }
  })
})
