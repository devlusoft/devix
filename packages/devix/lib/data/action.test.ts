import { beforeEach, describe, expect, it } from 'vitest'
import { action } from './action'
import { clearServerFns, getServerFn } from './server-registry'

beforeEach(() => {
  clearServerFns()
})

describe('action (server branch)', () => {
  it('registers the original function in the server-registry under `action:<name>`', () => {
    const original = (id: string) => ({ id })
    action(original, 'rename')
    expect(getServerFn('action:rename')).toBe(original)
  })

  it('awaits async callbacks', async () => {
    const fn = action(async (id: string) => ({ id, done: true }), 'rename-async')
    const result = await fn('1')
    expect(result).toEqual({ id: '1', done: true })
  })
})
