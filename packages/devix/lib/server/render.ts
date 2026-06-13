import type { ServerResponse } from 'node:http'
import type { Component, JSX } from 'solid-js'
import { renderToString } from 'solid-js/web'
import type { ViteDevServer } from 'vite'
import { compose } from '../hydration/compose'

export async function renderSSR(opts: {
  server?: ViteDevServer
  Root?: Component<{ children?: JSX.Element }>
  Routes?: Component<{ url?: string }>
  url: string
  res: ServerResponse
}): Promise<void> {
  let Root: Component<{ children?: JSX.Element }>
  let Routes: Component<{ url?: string }>

  if (opts.server) {
    const rootMod = await opts.server.ssrLoadModule('/app/root.tsx')
    const routesMod = await opts.server.ssrLoadModule('virtual:devix-routes')
    Root = (rootMod as { default: Component<{ children?: JSX.Element }> }).default
    Routes = (routesMod as { default: Component<{ url?: string }> }).default
  } else if (opts.Root && opts.Routes) {
    Root = opts.Root
    Routes = opts.Routes
  } else {
    throw new Error('devix: renderSSR requires either server or Root+Routes')
  }

  const html = renderToString(() => compose(Root, Routes, opts.url))
  opts.res.setHeader('Content-Type', 'text/html; charset=utf-8')
  opts.res.statusCode = 200
  opts.res.write('<!DOCTYPE html>')
  opts.res.write(html)
  opts.res.end()
}
