import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createAsync } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { For, Suspense } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { query } from '../data'
import { renderSSR } from './render'

type User = { id: string; name: string }

const USERS: User[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
]

const listUsers = query(async () => USERS, 'list-users')
const getUser = query(async (id: string) => {
  const user = USERS.find((u) => u.id === id)
  if (!user) throw new Error(`User ${id} not found`)
  return user
}, 'get-user')

function DataPage(): JSX.Element {
  const users = createAsync(() => listUsers())
  const firstUser = createAsync(() => getUser('1'))

  return (
    <section>
      <h1>Data page</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <ul>
          <For each={users() ?? []}>{(u) => <li>{u.name}</li>}</For>
        </ul>
      </Suspense>
      <Suspense fallback={<p>Loading…</p>}>
        <p>{firstUser()?.name}</p>
      </Suspense>
    </section>
  )
}

const Root = (props: { children?: JSX.Element }) => (
  <html lang="en">
    <head>
      <title>Test</title>
    </head>
    <body>{props.children}</body>
  </html>
)

const Routes = () => <DataPage />

describe('query server-only serialization', () => {
  it.skip('serializes query results into _$HY so the client does not refetch — TODO: requires createAsync in part 2', async () => {
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
      const html = await response.text()

      expect(html).toContain('Alice')
      expect(html).toContain('Bob')
      expect(html).toContain('Carol')
      expect(html).toContain('devix:query:list-users:')
      expect(html).toContain('devix:query:get-user:')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
