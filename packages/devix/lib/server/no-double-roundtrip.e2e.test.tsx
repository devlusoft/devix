import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createAsync } from '@solidjs/router'
import type { Component, JSX } from 'solid-js'
import { For, Suspense } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { renderSSR } from './render'

type User = { id: string; name: string }

const USERS: User[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
]

const mockListUsers = (): Promise<User[]> => Promise.resolve(USERS)
const mockGetUser = (id: string): Promise<User> => {
  const u = USERS.find((x) => x.id === id)
  if (!u) throw new Error(`User ${id} not found`)
  return Promise.resolve(u)
}

function DataPage(_props: { children?: JSX.Element }): JSX.Element {
  return (
    <section>
      <h1>Data page</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <ul>
          <UserList />
        </ul>
      </Suspense>
    </section>
  )
}

function UserList(): JSX.Element {
  const users = createAsync(() => mockListUsers(), { deferStream: true })
  return (
    <For each={users() ?? []}>
      {(u) => (
        <li>
          <a href={`/data/${u.id}`}>{u.name}</a>
        </li>
      )}
    </For>
  )
}

function FirstUserCard(): JSX.Element {
  const user = createAsync(() => mockGetUser('1'), { deferStream: true })
  return <strong>{user()?.name}</strong>
}

const Root: Component<{
  children?: JSX.Element
  assets?: JSX.Element
  scripts?: JSX.Element
}> = (props) => (
  <html lang="en">
    <head>
      {props.assets}
      <title>Test</title>
    </head>
    <body>
      {props.children}
      {props.scripts}
    </body>
  </html>
)

const Routes: Component<{ url?: string }> = () => (
  <>
    <DataPage />
    <FirstUserCard />
  </>
)

describe('no double roundtrip — server-side serialization', () => {
  it.skip('serializes query data into the HTML so the client does not need to refetch — TODO: requires createAsync in part 2', async () => {
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

      expect(html).toMatch(/_?\$?HY\.r\["[^"]+"\]/)
      expect(html).toMatch(/_?\$?HY\.r\["[^"]+"\]=\$?R\[\d+\]=/)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
