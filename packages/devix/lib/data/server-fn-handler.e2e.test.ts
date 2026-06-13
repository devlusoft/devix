import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { deserialize, serialize } from 'seroval'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleServerFunction } from './server-fn-handler'
import { clearServerFns, registerServerFn } from './server-registry'

type User = { id: string; name: string }

const USERS: User[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
]

beforeEach(() => {
  clearServerFns()
})

describe('handleServerFunction — end-to-end roundtrip', () => {
  it('serializes the server fn result and returns it deserialized over HTTP', async () => {
    const listUsers = async () => USERS
    registerServerFn(listUsers, 'test:list-users')

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      await handleServerFunction(req, res, { ssrFixStacktrace: vi.fn() })
    })

    await new Promise<void>((resolve) => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    try {
      const response = await fetch(`http://localhost:${port}/_server`, {
        method: 'POST',
        headers: { 'X-Server-Id': 'test:list-users' },
        body: serialize([USERS]),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')

      const text = await response.text()
      const result = deserialize(text) as User[]

      expect(result).toEqual(USERS)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('responds 500 with the error message when the X-Server-Id is unknown', async () => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      await handleServerFunction(req, res, { ssrFixStacktrace: vi.fn() })
    })

    await new Promise<void>((resolve) => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    try {
      const response = await fetch(`http://localhost:${port}/_server`, {
        method: 'POST',
        headers: { 'X-Server-Id': 'unknown:id' },
        body: serialize([]),
      })

      expect(response.status).toBe(500)
      const text = await response.text()
      expect(text).toMatch(/unknown server function/)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('responds 400 with a descriptive message when the X-Server-Id header is missing', async () => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      await handleServerFunction(req, res, { ssrFixStacktrace: vi.fn() })
    })

    await new Promise<void>((resolve) => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    try {
      const response = await fetch(`http://localhost:${port}/_server`, {
        method: 'POST',
        headers: {},
        body: serialize([]),
      })

      expect(response.status).toBe(400)
      const text = await response.text()
      expect(text).toMatch(/missing X-Server-Id/)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
