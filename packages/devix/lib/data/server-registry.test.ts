import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerServerFn,
  getServerFn,
  clearServerFns,
  listServerFns,
  type ServerFnMeta,
} from './server-registry.js'

describe('server-registry', () => {
  beforeEach(() => {
    clearServerFns()
  })

  it('registers and retrieves a server fn', () => {
    const fn = () => 42
    const meta: ServerFnMeta = { type: 'action', id: 'test:id', fn }
    registerServerFn(meta)
    expect(getServerFn('test:id')).toBe(meta)
  })

  it('returns undefined for unknown id', () => {
    expect(getServerFn('unknown')).toBeUndefined()
  })

  it('clears all server fns', () => {
    registerServerFn({ type: 'action', id: 'a', fn: () => 1 })
    registerServerFn({ type: 'action', id: 'b', fn: () => 2 })
    clearServerFns()
    expect(listServerFns()).toHaveLength(0)
  })

  it('overwrites a server fn with the same id', () => {
    const fn1 = () => 1
    const fn2 = () => 2
    registerServerFn({ type: 'action', id: 'a', fn: fn1 })
    registerServerFn({ type: 'action', id: 'a', fn: fn2 })
    expect(getServerFn('a')?.fn).toBe(fn2)
  })

  it('lists all server fns', () => {
    registerServerFn({ type: 'action', id: 'a', fn: () => 1 })
    registerServerFn({ type: 'query', id: 'b', fn: () => 2 })
    const list = listServerFns()
    expect(list).toHaveLength(2)
    expect(list.map((m) => m.id).sort()).toEqual(['a', 'b'])
  })
})
