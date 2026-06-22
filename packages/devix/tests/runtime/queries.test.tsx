// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import {
  runWithRequestEvent,
  createRequestEvent,
} from '../../lib/data/request-context'
import { clearServerFns } from '../../lib/data/server-registry'
import { query } from '../../lib/data/query'
import { buildQueryKey, clearPromiseCache } from '../../lib/data/query-client'
import { useQuery } from '../../lib/runtime/queries'

async function renderAsync(element: React.ReactElement): Promise<string> {
  const event = createRequestEvent('/test')
  let html = ''
  await runWithRequestEvent(event, async () => {
    html = await renderToPipeable(element)
  })
  return html
}

function renderToPipeable(element: React.ReactElement): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const writable = new PassThrough()
    const chunks: string[] = []
    writable.on('data', (chunk: Buffer) => chunks.push(chunk.toString()))
    writable.on('end', () => resolve(chunks.join('')))
    writable.on('error', reject)

    const { pipe } = renderToPipeableStream(element, {
      onAllReady() {
        pipe(writable)
      },
      onError(err) {
        reject(err)
      },
    })
  })
}

describe('useQuery', () => {
  beforeEach(() => {
    clearServerFns()
    clearPromiseCache()
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('renders a synchronous value without calling React.use', async () => {
    function Page() {
      const value = useQuery(() => 'sync-value')
      return createElement('span', null, value)
    }

    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<span>sync-value</span>')
  })

  it('unwraps a sync query result on the server', async () => {
    const getNumber = query(() => 42, 'getNumber')

    function Page() {
      const value = useQuery(() => getNumber())
      return createElement('h1', null, String(value))
    }

    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<h1>42</h1>')
  })

  it('unwraps an async query result via Suspense on the server', async () => {
    const getUser = query(
      async (id: string) => ({ id, name: 'Alice' }),
      'getUser',
    )

    function Page() {
      const data = useQuery(() => getUser('1'))
      return createElement('h1', null, data.name)
    }

    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<h1>Alice</h1>')
  })

  it('throws when given a pre-rejected promise', async () => {
    function Page() {
      const value = useQuery(() => Promise.reject(new Error('boom')))
      return createElement('span', null, String(value))
    }

    await expect(renderAsync(createElement(Page))).rejects.toThrow('boom')
  })

  it('returns hydration value synchronously on the client when present', async () => {
    const key = buildQueryKey('getUser', ['1'])
    ;(globalThis as unknown as { window?: Record<string, unknown> }).window = {
      __DEVIX_QUERIES__: { [key]: { name: 'Bob' } },
    }

    const getUser = query(
      (_id: string) => ({ should: 'not run' }),
      'getUser',
    )

    function Page() {
      const user = useQuery(() => getUser('1')) as unknown as { name: string }
      return createElement('h1', null, user.name)
    }

    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<h1>Bob</h1>')
  })

  it('memoizes the query fn reference across renders of the same instance', async () => {
    const fn = vi.fn((n: number) => n * 2)
    const getDouble = query(fn, 'getDouble')

    function Page({ count }: { count: number }) {
      const value = useQuery(() => getDouble(count))
      return createElement('span', null, `${value}-${count}`)
    }

    const html = await renderAsync(createElement(Page, { count: 5 }))
    expect(html).toContain('<span>10-5</span>')
    expect(fn).toHaveBeenCalledWith(5)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(2)
  })
})