import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { clientTransport, type Transport } from './transport.js'

describe('transport', () => {
  let originalFetch: typeof fetch
  let originalCurrent: Transport

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalCurrent = clientTransport.current
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clientTransport.current = originalCurrent
  })

  it('is swappable via .current', () => {
    const customTransport: Transport = vi.fn(async () => 'custom')
    clientTransport.current = customTransport
    expect(clientTransport.current).toBe(customTransport)
  })

  it('default transport posts to /_devix/server with X-Server-Id', async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response('"ok"', {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
    )
    globalThis.fetch = mockFetch as unknown as typeof fetch

    await clientTransport.current('action:test', [1, 2, 3])

    expect(mockFetch).toHaveBeenCalledWith(
      '/_devix/server',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Server-Id': 'action:test',
          'Content-Type': 'application/octet-stream',
        }),
      }),
    )
  })

  it('throws on non-ok response', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('error', { status: 500 }),
    ) as unknown as typeof fetch
    await expect(clientTransport.current('action:test', [])).rejects.toThrow('500')
  })
})
