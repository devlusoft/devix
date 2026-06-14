import { deserialize, serialize } from 'seroval'
import { beforeEach, describe, expect, it } from 'vitest'
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

function makeRequest(body: string, id?: string): Request {
  const headers = new Headers()
  if (id) headers.set('X-Server-Id', id)
  headers.set('Content-Type', 'application/json')
  return new Request('http://localhost/_devix/server', { method: 'POST', headers, body })
}

function captureRespond(): {
  responses: Array<{ status: number; headers: Headers; body: string }>
  respond: (response: { status: number; headers: Headers; body: string }) => void
} {
  const responses: Array<{ status: number; headers: Headers; body: string }> = []
  return {
    responses,
    respond: (response) => responses.push(response),
  }
}

describe('handleServerFunction — Web-Standards shape', () => {
  it('serializes the server fn result and returns it through respond', async () => {
    const listUsers = async () => USERS
    registerServerFn('test:list-users', 'query', listUsers)

    const { responses, respond } = captureRespond()
    await handleServerFunction(makeRequest(serialize([USERS]), 'test:list-users'), respond)

    expect(responses).toHaveLength(1)
    const response = responses[0]
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(deserialize(response.body)).toEqual(USERS)
  })

  it('responds 500 with the error message when the X-Server-Id is unknown', async () => {
    const { responses, respond } = captureRespond()
    await handleServerFunction(makeRequest(serialize([]), 'unknown:id'), respond)

    expect(responses[0].status).toBe(500)
    expect(responses[0].body).toMatch(/unknown server function/)
  })

  it('responds 400 with a descriptive message when the X-Server-Id header is missing', async () => {
    const { responses, respond } = captureRespond()
    await handleServerFunction(makeRequest(serialize([])), respond)

    expect(responses[0].status).toBe(400)
    expect(responses[0].body).toMatch(/missing X-Server-Id/)
  })
})
