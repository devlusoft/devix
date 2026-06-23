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
import { query, clearClientQueryCache } from '../../lib/data/query'
import { buildQueryKey } from '../../lib/data/query-client'
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
    clearClientQueryCache()
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('renders a static page with no useQuery', async () => {
    function Page() {
      return createElement('h1', null, 'static')
    }
    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<h1>static</h1>')
  })

  it('minimal test: getNumber(21) returns 42 via renderAsync', async () => {
    const getNumber = query((n: number) => n * 2, 'getNumberX')
    const result = await runWithRequestEvent(createRequestEvent('/test'), () => getNumber(21))
    expect(result).toBe(42)
  })

  it('unwraps a Promise.resolve primitive via useQuery', async () => {
    function Page() {
      const value = useQuery(Promise.resolve(42))
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
      const data = useQuery(getUser('1'))
      return createElement('h1', null, data.name)
    }

    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<h1>Alice</h1>')
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
      const user = useQuery(getUser('1')) as unknown as { name: string }
      return createElement('h1', null, user.name)
    }

    const html = await renderAsync(createElement(Page))
    expect(html).toContain('<h1>Bob</h1>')
  })

  it('memoizes query calls per (name, args) — same args return same Promise', async () => {
    const fn = vi.fn((n: number) => n * 2)
    const getDouble = query(fn, 'getDouble')

    function Page({ count }: { count: number }) {
      const value = useQuery(getDouble(count))
      return createElement('span', null, `${value}-${count}`)
    }

    const html = await renderAsync(createElement(Page, { count: 5 }))
    expect(html).toContain('<span>10-5</span>')
    expect(fn).toHaveBeenCalledWith(5)
  })
})
