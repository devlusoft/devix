import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import { use } from 'react'
import {
  runWithRequestEvent,
  createRequestEvent,
} from '../../src/data/request-context'
import { clearServerFns } from '../../src/data/server-registry'
import { query } from '../../src/data/query'
import { clearPromiseCache } from '../../src/data/query-client'
import { createHtmlStream } from '../../src/server/stream-html'
import { safeJsonStringify } from '../../src/utils/html'

async function renderToHtml(
  element: React.ReactElement,
  event = createRequestEvent('/test'),
): Promise<string> {
  const chunks: string[] = []

  await runWithRequestEvent(event, async () => {
    const head =
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body><div id="root">'
    const tail = '</div></body></html>'

    const { stream } = await createHtmlStream(element, head, tail, {
      beforeTail: (write) => {
        const map = event.queryHydration
        if (!map || map.size === 0) return
        const data = Object.fromEntries(map)
        write(`<script>window.__DEVIX_QUERIES__=${safeJsonStringify(data)};</script>`)
      },
    })

    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
    }
  })

  return chunks.join('')
}

describe('renderStream query hydration', () => {
  beforeEach(() => {
    clearServerFns()
    clearPromiseCache()
  })

  it('serializes query results into window.__DEVIX_QUERIES__', async () => {
    const getUser = query(
      async (id: string) => ({ id, name: 'Alice' }),
      'getUser',
    )

    function Page() {
      const data = use(getUser('1'))
      return createElement('h1', null, data.name)
    }

    const html = await renderToHtml(createElement(Page))

    expect(html).toContain('<h1>Alice</h1>')
    expect(html).toContain('window.__DEVIX_QUERIES__')

    const map = extractQueries(html)
    expect(Object.keys(map)).toEqual(['devix:query:getUser:["1"]'])
    expect(map['devix:query:getUser:["1"]']).toEqual({ id: '1', name: 'Alice' })
  })

  it('serializes multiple queries in the same render', async () => {
    const getUser = query(
      async (id: string) => ({ id, name: 'Alice' }),
      'getUser',
    )
    const listPosts = query(
      async () => [{ id: 'p1' }, { id: 'p2' }],
      'listPosts',
    )

    function Page() {
      const user = use(getUser('1'))
      const posts = use(listPosts())
      return createElement(
        'section',
        null,
        createElement('h1', null, user.name),
        createElement(
          'ul',
          null,
          posts.map((p) => createElement('li', { key: p.id }, p.id)),
        ),
      )
    }

    const html = await renderToHtml(createElement(Page))

    expect(html).toContain('<h1>Alice</h1>')
    expect(html).toContain('<li>p1</li>')
    expect(html).toContain('<li>p2</li>')

    const map = extractQueries(html)
    expect(map['devix:query:getUser:["1"]']).toEqual({ id: '1', name: 'Alice' })
    expect(map['devix:query:listPosts:[]']).toEqual([{ id: 'p1' }, { id: 'p2' }])
  })

  it('does not write __DEVIX_QUERIES__ when no queries ran', async () => {
    function Page() {
      return createElement('h1', null, 'static')
    }

    const html = await renderToHtml(createElement(Page))

    expect(html).toContain('<h1>static</h1>')
    expect(html).not.toContain('window.__DEVIX_QUERIES__')
  })

  it('serializes undefined query results as null', async () => {
    const maybeMissing = query(async () => undefined, 'maybeMissing')

    function Page() {
      const value = use(maybeMissing())
      return createElement('span', null, value === undefined ? 'absent' : 'present')
    }

    const html = await renderToHtml(createElement(Page))

    expect(html).toContain('<span>absent</span>')

    const map = extractQueries(html)
    expect(map['devix:query:maybeMissing:[]']).toBeNull()
  })
})

function extractQueries(html: string): Record<string, unknown> {
  const match = html.match(/window\.__DEVIX_QUERIES__=({[^<]*});/)
  if (!match) {
    throw new Error(`Could not find __DEVIX_QUERIES__ in HTML: ${html}`)
  }
  return JSON.parse(match[1])
}