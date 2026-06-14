import { deserialize, serialize } from 'seroval'
import { beforeEach, describe, expect, it } from 'vitest'
import { action, devixAction } from './action'
import { query } from './query'
import { handleServerFunction } from './server-fn-handler'
import { clearServerFns } from './server-registry'

beforeEach(() => {
  clearServerFns()
})

function makeRequest(body: string, id: string): Request {
  const headers = new Headers()
  headers.set('X-Server-Id', id)
  headers.set('Content-Type', 'application/json')
  return new Request('http://localhost/_devix/server', { method: 'POST', headers, body })
}

async function dispatch(req: Request): Promise<{ status: number; body: string }> {
  let response: { status: number; headers: Headers; body: string } | undefined
  await handleServerFunction(req, (r) => {
    response = r
  })
  if (!response) throw new Error('No response')
  return { status: response.status, body: response.body }
}

describe('server functions integration', () => {
  it('executes a registered query via RPC', async () => {
    const getUser = query(async (id: string) => ({ id, name: 'Alice' }), 'getUser')

    const serverResult = await getUser('1')
    expect(serverResult).toEqual({ id: '1', name: 'Alice' })

    const res = await dispatch(makeRequest(serialize(['2']), 'getUser'))
    expect(res.status).toBe(200)
    expect(deserialize(res.body)).toEqual({ id: '2', name: 'Alice' })
  })

  it('executes a registered action via RPC', async () => {
    const updateUser = devixAction('updateUser', async (id: string, name: string) => ({ id, name }))

    const serverResult = await updateUser('1', 'Bob')
    expect(serverResult).toEqual({ id: '1', name: 'Bob' })

    const res = await dispatch(makeRequest(serialize(['2', 'Carol']), 'updateUser'))
    expect(res.status).toBe(200)
    expect(deserialize(res.body)).toEqual({ id: '2', name: 'Carol' })
  })

  it('action fallback registers with function name', async () => {
    async function renameUser(id: string) {
      return { id, renamed: true }
    }
    action(renameUser)

    const res = await dispatch(makeRequest(serialize(['42']), 'action:renameUser'))
    expect(res.status).toBe(200)
    expect(deserialize(res.body)).toEqual({ id: '42', renamed: true })
  })
})
