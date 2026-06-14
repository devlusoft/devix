import type { ServerResponse } from 'node:http'
import type { Component } from 'solid-js'
import type { ViteDevServer } from 'vite'
import type { DevixRootProps } from '../hydration/compose'
import { createRenderFn } from './render-shared'

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
    const routesMod = await opts.server.ssrLoadModule('virtual:devix-routes-ssr')
    Root = (rootMod as { default: Component<DevixRootProps> }).default
    Routes = (routesMod as { default: Component<{ url?: string }> }).default
  } else if (opts.Root && opts.Routes) {
    Root = opts.Root
    Routes = opts.Routes
  } else {
    throw new Error('devix: renderSSR requires either server or Root+Routes')
  }

  const { stream, getHeaders, onShellReady } = createRenderFn(Root, Routes, opts.url)

  return new Promise((resolve) => {
    onShellReady(() => {
      for (const [key, value] of getHeaders().entries()) {
        opts.res.setHeader(key, value)
      }
      opts.res.setHeader('Content-Type', 'text/html; charset=utf-8')
      opts.res.statusCode = 200
      opts.res.write('<!DOCTYPE html>')
      resolve()
    })

    stream.pipe({
      write: (chunk: string) => opts.res.write(chunk),
      end: () => opts.res.end(),
    })
  })
}
