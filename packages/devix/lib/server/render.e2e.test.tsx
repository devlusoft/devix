import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { JSX } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { renderSSR } from './render'

describe('renderSSR e2e', () => {
  it('serves HTML with DOCTYPE and rendered content via real http server', async () => {
    const Root = (props: { children?: JSX.Element }) => (
      <html lang="en">
      <head></head>
      <body>{props.children}</body>
      </html>
    )
    const Routes = () => <h1>hi</h1>

    const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
      renderSSR({ Root, Routes, url: '/', res }).catch((err) => {
        res.statusCode = 500
        res.end(String(err))
      })
    })

    await new Promise<void>((resolve) => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    try {
      const response = await fetch(`http://localhost:${port}/`)
      expect(response.status).toBe(200)
      const body = await response.text()
      expect(body).toMatch(/^<!DOCTYPE html>/)
      expect(body).toMatch(/<h1[^>]*>hi<\/h1>/)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
