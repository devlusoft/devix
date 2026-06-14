import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientTransport, type Transport } from './transport'

vi.mock('seroval', () => ({
  serialize: vi.fn((args: unknown[]) => `serialized:${JSON.stringify(args)}`),
  deserialize: vi.fn((text: string) => JSON.parse(text.replace(/^serialized:/, ''))),
}))

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('defaultFetchTransport', () => {
  it('POSTs to /_server with X-Server-Id header and serialized body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('serialized:"alice"'),
    })

    const result = await clientTransport.current<string>('users.ts#getUser', [42])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/_devix/server')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Server-Id']).toBe('users.ts#getUser')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('serialized:[42]')
    expect(result).toBe('alice')
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    })

    await expect(clientTransport.current('id', [])).rejects.toThrow(/failed.*500/)
  })
})

describe('clientTransport override', () => {
  it('can be replaced with a custom transport via .current', async () => {
    const original = clientTransport.current
    const custom = vi.fn(async () => 'mocked') as unknown as Transport

    try {
      clientTransport.current = custom
      const result = await clientTransport.current<string>('id', [1, 2])

      expect(custom).toHaveBeenCalledWith('id', [1, 2])
      expect(result).toBe('mocked')
    } finally {
      clientTransport.current = original
    }
  })
})
