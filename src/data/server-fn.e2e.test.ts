import { describe, it, expect, beforeEach } from 'vitest'
import { decode } from 'turbo-stream'
import { collectEncode } from '../utils/turbo-serializer.js'
import { handleServerFunction, type ServerFnResponse } from './server-fn-handler.js'
import { registerServerFn, clearServerFns, listServerFns, type ServerFnMeta } from './server-registry.js'
import { action } from './action.js'

function stringToStream(s: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(s)
      controller.close()
    },
  })
}

describe('server-fn e2e', () => {
  beforeEach(() => {
    clearServerFns()
  })

  it('full chain: action() registration → handler → turbo-stream response', async () => {
    action(async (n: number) => n * 2)
    expect(listServerFns()).toHaveLength(1)
    const meta = listServerFns()[0]!
    expect(meta.id).toMatch(/^action:/)

    const body = await collectEncode([7])
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: {
        'X-Server-Id': meta.id,
      },
      body,
    })

    let response: ServerFnResponse | null = null
    await handleServerFunction(
      request,
      (r) => {
        response = r
      },
      () => ({ cookies: () => ({}), pathname: '/test' }),
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(200)
    const result = (await decode(stringToStream(response!.body))) as number
    expect(result).toBe(14)
  })

  it('handles complex types via turbo-stream (Date, nested objects)', async () => {
    type ComplexInput = { name: string; tags: string[]; when: Date }
    type ComplexOutput = ComplexInput & { reversed: string; tagCount: number }
    const fn = (async (data: ComplexInput): Promise<ComplexOutput> => ({
      ...data,
      reversed: data.name.split('').reverse().join(''),
      tagCount: data.tags.length,
    })) as ServerFnMeta['fn']
    registerServerFn({ type: 'action', id: 'action:complex', fn })

    const body = await collectEncode([{ name: 'devix', tags: ['a', 'b', 'c'], when: new Date(0) }])
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: { 'X-Server-Id': 'action:complex' },
      body,
    })

    let response: ServerFnResponse | null = null
    await handleServerFunction(
      request,
      (r) => {
        response = r
      },
      () => ({ cookies: () => ({}), pathname: '/' }),
    )

    expect(response!.status).toBe(200)
    const result = (await decode(stringToStream(response!.body))) as ComplexOutput
    expect(result.reversed).toBe('xived')
    expect(result.tagCount).toBe(3)
    expect(result.when).toBeInstanceOf(Date)
  })

  it('async fn: result is awaited before serialization', async () => {
    const fn = (async () => {
      await new Promise((r) => setTimeout(r, 5))
      return 'done'
    }) as ServerFnMeta['fn']
    registerServerFn({ type: 'action', id: 'action:delay', fn })
    const body = await collectEncode([])
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: { 'X-Server-Id': 'action:delay' },
      body,
    })
    let response: ServerFnResponse | null = null
    await handleServerFunction(
      request,
      (r) => {
        response = r
      },
      () => ({ cookies: () => ({}), pathname: '/' }),
    )
    expect(response!.status).toBe(200)
    const result = (await decode(stringToStream(response!.body))) as string
    expect(result).toBe('done')
  })

  it('rejects on missing X-Server-Id (consistent error shape)', async () => {
    const request = new Request('http://localhost/_devix/server', { method: 'POST' })
    let response: ServerFnResponse | null = null
    await handleServerFunction(
      request,
      (r) => {
        response = r
      },
      () => ({ cookies: () => ({}), pathname: '/' }),
    )
    expect(response!.status).toBe(400)
    expect(JSON.parse(response!.body)).toMatchObject({ error: expect.any(String) })
  })
})
