import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action, devixAction, devixActionClient } from './action'
import { clearServerFns, getServerFn } from './server-registry'

beforeEach(() => {
  clearServerFns()
})

describe('devixAction', () => {
  it('registers the original function in the server-registry under the given id', () => {
    const original = (id: string) => ({ id })
    devixAction('action:rename', original)

    expect(getServerFn('action:rename').fn).toBe(original)
    expect(getServerFn('action:rename').type).toBe('action')
  })

  it('awaits async callbacks', async () => {
    const fn = devixAction('action:rename-async', async (id: string) => ({ id, done: true }))
    const result = await fn('1')
    expect(result).toEqual({ id: '1', done: true })
  })

  it('executes on the server directly', async () => {
    const original = vi.fn(async (id: string) => ({ id }))
    const fn = devixAction('action:server', original)

    const result = await fn('42')

    expect(original).toHaveBeenCalledWith('42')
    expect(result).toEqual({ id: '42' })
  })
})

describe('devixActionClient', () => {
  it('does not register the function', () => {
    devixActionClient('action:client-only')
    expect(() => getServerFn('action:client-only')).toThrow(/unknown server function/)
  })
})

describe('action fallback', () => {
  it('uses the function name to build a fallback id', () => {
    function myAction() {
      return 'ok'
    }
    action(myAction)

    expect(getServerFn('action:myAction').fn).toBe(myAction)
  })
})
