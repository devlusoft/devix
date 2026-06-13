import type { ServerResponse } from 'node:http'
import type { Component } from 'solid-js'
import type { ViteDevServer } from 'vite'
import { compose, type DevixRootProps } from '../hydration/compose'
import { renderToStream } from '../streaming/render-to-stream'

export async function renderSSR(opts: {
  server?: ViteDevServer
  Root?: Component<DevixRootProps>
  Routes?: Component<{ url?: string }>
  url: string
  res: ServerResponse
}): Promise<void> {
  let Root: Component<DevixRootProps>
  let Routes: Component<{ url?: string }>

  if (opts.server) {
    const rootMod = await opts.server.ssrLoadModule('/app/root.tsx')
    const routesMod = await opts.server.ssrLoadModule('virtual:devix-routes')
    Root = (rootMod as { default: Component<DevixRootProps> }).default
    Routes = (routesMod as { default: Component<{ url?: string }> }).default
  } else if (opts.Root && opts.Routes) {
    Root = opts.Root
    Routes = opts.Routes
  } else {
    throw new Error('devix: renderSSR requires either server or Root+Routes')
  }

  opts.res.setHeader('Content-Type', 'text/html; charset=utf-8')
  opts.res.statusCode = 200
  opts.res.write('<!DOCTYPE html>')
  const stream = renderToStream(() => compose(Root, Routes, opts.url))
  const writable = {
    write: (chunk: string) => {
      opts.res.write(chunk)
    },
    end: () => {
      opts.res.end()
    },
  }
  stream.pipe(writable as { write: (v: string) => void })
}
