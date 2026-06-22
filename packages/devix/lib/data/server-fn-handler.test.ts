import { describe, it, expect, beforeEach } from 'vitest'
import { collectEncode } from '../utils/turbo-serializer.js'
import { handleServerFunction, type ServerFnResponse } from './server-fn-handler.js'
import { registerServerFn, clearServerFns, type ServerFnMeta } from './server-registry.js'

function stringToStream(s: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(s)
      controller.close()
    },
  })
}

function captureRespond(): { responses: ServerFnResponse[]; respond: (r: ServerFnResponse) => void } {
  const responses: ServerFnResponse[] = []
  return { responses, respond: (r) => responses.push(r) }
}

describe('handleServerFunction', () => {
  beforeEach(() => {
    clearServerFns()
  })

  it('returns 400 when X-Server-Id is missing', async () => {
    const request = new Request('http://localhost/_devix/server', { method: 'POST' })
    const { responses, respond } = captureRespond()
    await handleServerFunction(
      request,
      respond,
      () => ({ cookies: () => ({}), pathname: '/' }),
    )
    expect(responses[0]?.status).toBe(400)
    expect(JSON.parse(responses[0]!.body).error).toMatch(/Missing X-Server-Id/)
  })

  it('returns 500 when server fn id is unknown', async () => {
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: { 'X-Server-Id': 'action:unknown' },
    })
    const { responses, respond } = captureRespond()
    await handleServerFunction(
      request,
      respond,
      () => ({ cookies: () => ({}), pathname: '/' }),
    )
    expect(responses[0]?.status).toBe(500)
    expect(JSON.parse(responses[0]!.body).error).toMatch(/Unknown server fn/)
  })

  it('runs the server fn and serializes the result', async () => {
    const fn = (async (n: number) => n * 2) as ServerFnMeta['fn']
    registerServerFn({ type: 'action', id: 'action:double', fn })
    const body = await collectEncode([5])
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: { 'X-Server-Id': 'action:double' },
      body,
    })
    const { responses, respond } = captureRespond()
    await handleServerFunction(
      request,
      respond,
      () => ({ cookies: () => ({}), pathname: '/' }),
    )
    expect(responses[0]?.status).toBe(200)
    const { decode } = await import('turbo-stream')
    const decoded = (await decode(stringToStream(responses[0]!.body))) as number
    expect(decoded).toBe(10)
  })

  it('returns 500 when the fn throws', async () => {
    const fn = (async () => {
      throw new Error('boom')
    }) as ServerFnMeta['fn']
    registerServerFn({ type: 'action', id: 'action:throw', fn })
    const body = await collectEncode([])
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: { 'X-Server-Id': 'action:throw' },
      body,
    })
    const { responses, respond } = captureRespond()
    await handleServerFunction(
      request,
      respond,
      () => ({ cookies: () => ({}), pathname: '/' }),
    )
    expect(responses[0]?.status).toBe(500)
    expect(JSON.parse(responses[0]!.body).error).toMatch(/boom/)
  })

  it('provides the request event to the fn (cookies readable)', async () => {
    const { getRequestEvent } = await import('./request-context.js')
    let receivedToken: string | undefined
    const fn = (() => {
      receivedToken = getRequestEvent()?.cookies().token
      return receivedToken
    }) as ServerFnMeta['fn']
    registerServerFn({ type: 'action', id: 'action:cookie', fn })
    const body = await collectEncode([])
    const request = new Request('http://localhost/_devix/server', {
      method: 'POST',
      headers: { 'X-Server-Id': 'action:cookie', cookie: 'token=abc123' },
      body,
    })
    await handleServerFunction(
      request,
      () => {},
      () => ({
        cookies: () => {
          const c: Record<string, string> = {}
          for (const p of 'token=abc123'.split(';')) {
            const eq = p.indexOf('=')
            if (eq < 0) continue
            c[p.slice(0, eq).trim()] = p.slice(eq + 1).trim()
          }
          return c
        },
        pathname: '/test',
      }),
    )
    expect(receivedToken).toBe('abc123')
  })
})
