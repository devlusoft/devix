import { beforeEach, describe, expect, it } from 'vitest'
import { clearServerFns, getServerFn, registerServerFn } from './server-registry'

beforeEach(() => {
  clearServerFns()
})

describe('registerServerFn', () => {
  it('registers a function with the given id and type', () => {
    const fn = () => 42
    registerServerFn('test:fn', 'query', fn)

    expect(getServerFn('test:fn')).toEqual({ id: 'test:fn', type: 'query', fn })
  })

  it('overwrites a previous registration with the same id', () => {
    const first = () => 1
    const second = () => 2
    registerServerFn('test:fn', 'query', first)
    registerServerFn('test:fn', 'query', second)

    expect(getServerFn('test:fn').fn).toBe(second)
  })
})

describe('getServerFn', () => {
  it('throws a descriptive error when the id is unknown', () => {
    expect(() => getServerFn('nope')).toThrow(/unknown server function/)
  })
})

describe('clearServerFns', () => {
  it('removes all registered functions', () => {
    registerServerFn('test:fn', 'query', () => 1)
    clearServerFns()

    expect(() => getServerFn('test:fn')).toThrow()
  })
})
