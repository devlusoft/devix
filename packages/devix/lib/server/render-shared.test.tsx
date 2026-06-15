import type { Component } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { DevixRootProps } from '../hydration/compose'
import { createRenderFn, type RenderHandle } from './render-shared'

const Root: Component<DevixRootProps> = (props) => (
  <html lang="en">
    <head>{props.assets}</head>
    <body>
      {props.children}
      {props.scripts}
    </body>
  </html>
)

const Routes: Component<{ url?: string }> = () => <h1>hello</h1>

async function collect(handle: RenderHandle): Promise<string> {
  const chunks: string[] = []
  const writable = new WritableStream({
    write(chunk) {
      chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk))
    },
  })
  await handle.stream.pipeTo(writable)
  return chunks.join('')
}

describe('createRenderFn', () => {
  it('renders the shell with content and sets Content-Type', async () => {
    const handle = createRenderFn(Root, Routes, '/')
    const html = await collect(handle)
    expect(html).toContain('>hello<')
    expect(handle.getHeaders().get('Content-Type')).toBe('text/html; charset=utf-8')
  })

  it('invokes onShellReady callback before stream completes', async () => {
    let shellReady = false
    const handle = createRenderFn(Root, Routes, '/foo')
    handle.onShellReady(() => {
      shellReady = true
    })
    await collect(handle)
    expect(shellReady).toBe(true)
  })

  it('starts with status 200 by default', () => {
    const handle = createRenderFn(Root, Routes, '/')
    expect(handle.getStatus()).toBe(200)
  })

  it('renders provided styles before the hydration script', async () => {
    const styleLink = <link rel="stylesheet" href="/app.css" />
    const handle = createRenderFn(Root, Routes, '/', { styles: [styleLink] })
    const html = await collect(handle)

    expect(html).toMatch(/<link[^>]*rel="stylesheet"[^>]*href="\/app\.css"[^>]*>/)
    const linkIndex = html.search(/<link[^>]*rel="stylesheet"[^>]*href="\/app\.css"[^>]*>/)
    const scriptIndex = html.indexOf('<script data-hk="030"')
    expect(linkIndex).toBeLessThan(scriptIndex)
  })
})
