import { beforeEach, describe, expect, it } from 'vitest'
import { clearServerFns, getServerFn, registerServerFn } from './server-registry'

beforeEach(() => {
  clearServerFns()
})

describe('registerServerFn', () => {
  it('registers a function with the given id', () => {
    const fn = () => 42
    registerServerFn(fn, 'test:fn')

    expect(getServerFn('test:fn')).toBe(fn)
  })

  it('returns the original function (for chaining)', () => {
    const fn = () => 42
    const result = registerServerFn(fn, 'test:fn')

    expect(result).toBe(fn)
  })

  it('overwrites a previous registration with the same id', () => {
    const first = () => 1
    const second = () => 2
    registerServerFn(first, 'test:fn')
    registerServerFn(second, 'test:fn')

    expect(getServerFn('test:fn')).toBe(second)
  })
})

describe('getServerFn', () => {
  it('throws a descriptive error when the id is unknown', () => {
    expect(() => getServerFn('nope')).toThrow(/unknown server function/)
  })
})

describe('clearServerFns', () => {
  it('removes all registered functions', () => {
    registerServerFn(() => 1, 'test:fn')
    clearServerFns()

    expect(() => getServerFn('test:fn')).toThrow()
  })
})
