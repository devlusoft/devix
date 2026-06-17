import type { ServerResponse } from 'node:http'
import type { Component } from 'solid-js'
import type { ViteDevServer } from 'vite'
import type { DevixRootProps } from '../hydration/compose'
import type { ManifestRouteNode } from '../router/preload'
import { preloadRoutesForUrl } from '../router/preload'
import { createRenderFn } from './render-shared'
import { collectDevStyles } from './styles'

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
    const manifest = (routesMod as { manifest?: ManifestRouteNode[] }).manifest
    if (manifest) {
      await preloadRoutesForUrl(opts.url, manifest)
    }
  } else if (opts.Root && opts.Routes) {
    Root = opts.Root
    Routes = opts.Routes
  } else {
    throw new Error('devix: renderSSR requires either server or Root+Routes')
  }

  let styles: string[] | undefined
  if (opts.server?.moduleGraph) {
    styles = collectDevStyles(opts.server)
  }

  const { stream, getHeaders, onShellReady } = createRenderFn(Root, Routes, opts.url, {
    styles,
  })

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
