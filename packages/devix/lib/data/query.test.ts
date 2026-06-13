import { beforeEach, describe, expect, it } from 'vitest'
import { query } from './query'
import { clearServerFns, getServerFn } from './server-registry'

beforeEach(() => {
  clearServerFns()
})

describe('query (server branch)', () => {
  it('registers the function in the server-registry under `query:<name>`', () => {
    const original = (x: string) => `echo:${x}`
    query(original, 'echo')

    expect(getServerFn('query:echo')).toBe(original)
  })

  it('invokes the callback directly when called', async () => {
    const fn = query((x: number) => x * 2, 'double')
    const result = await fn(5)
    expect(result).toBe(10)
  })

  it('passes positional args correctly', async () => {
    const fn = query((a: string, b: number, c: boolean) => `${a}-${b}-${c}`, 'concat')
    const result = await fn('x', 7, true)
    expect(result).toBe('x-7-true')
  })

  it('awaits async callbacks', async () => {
    const fn = query(async (x: number) => x * 2, 'double-async')
    const result = await fn(5)
    expect(result).toBe(10)
  })
})
