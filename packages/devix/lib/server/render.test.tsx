import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import type { JSX } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { renderSSR } from './render'

type ServerResponseMock = {
  res: ServerResponse
  writes: string[]
  setHeaders: Record<string, string>
  ended: () => boolean
  waitForEnd: () => Promise<void>
}

function mockResponse(): ServerResponseMock {
  const writes: string[] = []
  const setHeaders: Record<string, string> = {}
  let ended = false
  const emitter = new EventEmitter()
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
      emitter.emit('end')
    },
    once: (event: string, listener: () => void) => {
      emitter.once(event, listener)
      return res
    },
    on: (event: string, listener: () => void) => {
      emitter.on(event, listener)
      return res
    },
  } as unknown as ServerResponse
  return {
    res,
    writes,
    setHeaders,
    ended: () => ended,
    waitForEnd: () => new Promise<void>((resolve) => emitter.once('end', resolve)),
  }
}

function mockServer(ssrLoadModule: (id: string) => unknown) {
  return {
    ssrLoadModule: async (id: string) => ssrLoadModule(id),
  } as unknown as Parameters<typeof renderSSR>[0]['server']
}

describe('renderSSR — happy path', () => {
  it('sets Content-Type and status 200 before writing the body', async () => {
    const Root = (props: { children?: JSX.Element }) => <>{props.children}</>
    const Routes = () => <span>hi</span>
    const server = mockServer((id) => {
      if (id === '/app/root.tsx') return { default: Root }
      if (id === 'virtual:devix-routes-ssr') return { default: Routes }
      return {}
    })

    const { res, writes, setHeaders, ended, waitForEnd } = mockResponse()
    await renderSSR({ server, url: '/', res })
    await waitForEnd()

    expect(setHeaders['Content-Type']).toBe('text/html; charset=utf-8')
    expect(writes.length).toBeGreaterThan(0)
    expect(ended()).toBe(true)
  })

  it('emits the rendered markup through res.write', async () => {
    const Root = (props: { children?: JSX.Element }) => <div>{props.children}</div>
    const Routes = () => <span>hi</span>
    const server = mockServer((id) => {
      if (id === '/app/root.tsx') return { default: Root }
      if (id === 'virtual:devix-routes-ssr') return { default: Routes }
      return {}
    })

    const { res, writes, waitForEnd } = mockResponse()
    await renderSSR({ server, url: '/', res })
    await waitForEnd()

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
      if (id === 'virtual:devix-routes-ssr') return { default: Routes }
      return {}
    })

    const { res, writes, waitForEnd } = mockResponse()
    await renderSSR({ server, url: '/', res })
    await waitForEnd()

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
      if (id === 'virtual:devix-routes-ssr') return { default: Routes }
      return {}
    })

    const { res, writes, waitForEnd } = mockResponse()
    await renderSSR({ server, url: 'https://example.com/foo', res })
    await waitForEnd()

    const html = writes.join('')
    expect(html).toContain('data-routes="https://example.com/foo"')
  })
})
