import type { ServerResponse } from 'node:http'
import type { JSX } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { renderSSR } from './render'

type ServerResponseMock = {
  res: ServerResponse
  writes: string[]
  setHeaders: Record<string, string>
  ended: () => boolean
}

function mockResponse(): ServerResponseMock {
  const writes: string[] = []
  const setHeaders: Record<string, string> = {}
  let ended = false
  const res = {
    setHeader(name: string, value: string) {
      setHeaders[name] = value
    },
    get statusCode() {
      return 0
    },
    set statusCode(_: number) {},
    write: (chunk: string) => {
      writes.push(chunk)
      return true
    },
    end: () => {
      ended = true
    },
  } as unknown as ServerResponse
  return { res, writes, setHeaders, ended: () => ended }
}

async function flush() {
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => setTimeout(r, 0))
  }
  await new Promise<void>((r) => setImmediate(r))
}

function mockServer(ssrLoadModule: (id: string) => unknown) {
  return {
    ssrLoadModule: async (id: string) => ssrLoadModule(id),
  } as unknown as Parameters<typeof renderSSR>[0]
}

describe('renderSSR — happy path', () => {
  it('sets Content-Type and status 200 before writing the body', async () => {
    const Root = (props: { children?: JSX.Element }) => <>{props.children}</>
    const Routes = () => <span>hi</span>
    const server = mockServer((id) => {
      if (id === '/app/root.tsx') return { default: Root }
      if (id === 'virtual:devix-routes') return { default: Routes }
      return {}
    })

    const { res, writes, setHeaders, ended } = mockResponse()
    await renderSSR(server, '/', res)
    await flush()

    expect(setHeaders['Content-Type']).toBe('text/html; charset=utf-8')
    expect(writes.length).toBeGreaterThan(0)
    expect(ended()).toBe(true)
  })

  it('emits the rendered markup through res.write', async () => {
    const Root = (props: { children?: JSX.Element }) => <div>{props.children}</div>
    const Routes = () => <span>hi</span>
    const server = mockServer((id) => {
      if (id === '/app/root.tsx') return { default: Root }
      if (id === 'virtual:devix-routes') return { default: Routes }
      return {}
    })

    const { res, writes } = mockResponse()
    await renderSSR(server, '/', res)
    await flush()

    const html = writes.join('')
    expect(typeof html).toBe('string')
    expect(html).toMatch(/<span[^>]*>hi<\/span>/)
  })

  it('prepends <!DOCTYPE html> as the first output chunk', async () => {
    const Root = (props: { children?: JSX.Element }) => (
      <html lang="en">
        <body>{props.children}</body>
      </html>
    )
    const Routes = () => <div>page</div>
    const server = mockServer((id) => {
      if (id === '/app/root.tsx') return { default: Root }
      if (id === 'virtual:devix-routes') return { default: Routes }
      return {}
    })

    const { res, writes } = mockResponse()
    await renderSSR(server, '/', res)
    await flush()

    expect(writes[0]).toMatch(/^<!DOCTYPE html>/)
  })

  it('propagates the URL from middleware into the Routes component via props.url', async () => {
    const Root = (props: { children?: JSX.Element }) => <div>{props.children}</div>
    const Routes = (props: { url?: string }) => {
      const u = props.url ?? '/'
      return <span data-routes={u}>routes-content</span>
    }
    const server = mockServer((id) => {
      if (id === '/app/root.tsx') return { default: Root }
      if (id === 'virtual:devix-routes') return { default: Routes }
      return {}
    })

    const { res, writes } = mockResponse()
    await renderSSR(server, 'https://example.com/foo', res)
    await flush()

    const html = writes.join('')
    expect(html).toContain('data-routes="https://example.com/foo"')
  })
})
