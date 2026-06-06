import type { ServerResponse } from 'node:http'
import type { Component, JSX } from 'solid-js'
import { generateHydrationScript } from 'solid-js/web'
import type { ViteDevServer } from 'vite'
import { compose } from '../hydration/compose'
import { renderToStream } from '../streaming/render-to-stream'

const HYDRATION_BOOTSTRAP = generateHydrationScript()
const HYDRATION_MODULE =
  '<script type="module" src="/' + '@id/' + 'virtual:devix-hydration"></script>'

export async function renderSSR(
  server: ViteDevServer,
  url: string,
  res: ServerResponse,
): Promise<void> {
  const rootMod = await server.ssrLoadModule('/app/root.tsx')
  const routesMod = await server.ssrLoadModule('virtual:devix-routes')
  const Root = (rootMod as { default: Component<{ children?: JSX.Element }> }).default
  const Routes = (routesMod as { default: Component<{ url?: string }> }).default

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.statusCode = 200

  let prepended = false
  const writable = {
    write: (chunk: string) => {
      if (!prepended) {
        res.write('<!DOCTYPE html>')
        res.write(HYDRATION_BOOTSTRAP)
        prepended = true
      }
      res.write(chunk)
    },
    end: () => {
      res.write(HYDRATION_MODULE)
      res.end()
    },
  }

  const stream = renderToStream(() => compose(Root, Routes, url))
  stream.pipe(writable as { write: (v: string) => void })
}
