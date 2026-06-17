import type { Component } from 'solid-js'
import { createRequestEvent, runWithRequestEvent } from '../data/request-context'
import { compose, type DevixRootProps } from '../hydration/compose'
import { renderToStream, type StreamRender } from '../streaming/render-to-stream'

export type RenderHandle = {
  stream: StreamRender
  getHeaders: () => Headers
  getStatus: () => number
  onShellReady: (cb: () => void) => void
  onAllReady: (cb: () => void) => void
}

export type RenderOptions = {
  clientEntry?: string
  styles?: string[]
}

export function createRenderFn(
  Root: Component<DevixRootProps>,
  Routes: Component<{ url?: string }>,
  url: string,
  options: string | RenderOptions = {},
): RenderHandle {
  const event = createRequestEvent(url)
  let status = 200
  let stream!: StreamRender
  let shellFired = false
  let allFired = false
  const shellPending: Array<() => void> = []
  const allPending: Array<() => void> = []

  const opts = typeof options === 'string' ? { clientEntry: options } : options

  runWithRequestEvent(event, () => {
    stream = renderToStream(() => compose(Root, Routes, url, opts), {
      onShellReady() {
        event.response.headers.set('Content-Type', 'text/html; charset=utf-8')
        shellFired = true
        for (const cb of shellPending) cb()
        shellPending.length = 0
      },
      onAllReady() {
        allFired = true
        for (const cb of allPending) cb()
        allPending.length = 0
      },
      onError(err) {
        status = 500
        event.response.headers.set('Content-Type', 'text/plain; charset=utf-8')
        console.error('devix: render error', err)
      },
    })
  })

  return {
    stream,
    getHeaders: () => event.response.headers,
    getStatus: () => status,
    onShellReady(cb) {
      if (shellFired) cb()
      else shellPending.push(cb)
    },
    onAllReady(cb) {
      if (allFired) cb()
      else allPending.push(cb)
    },
  }
}
