import { encode } from '../vendor/turbo-encode.js'
import { decodeResponse } from '../utils/turbo-serializer.js'

export type Transport = (id: string, args: unknown[]) => Promise<unknown>

async function readStreamToString(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += value
  }
  return result
}

async function defaultTransport(id: string, args: unknown[]): Promise<unknown> {
  const body = await readStreamToString(encode(args))
  const res = await fetch('/_devix/server', {
    method: 'POST',
    headers: {
      'X-Server-Id': id,
      'Content-Type': 'application/octet-stream',
    },
    body,
  })
  if (!res.ok) throw new Error(`Server function failed: ${res.status}`)
  return decodeResponse(res)
}

export const clientTransport: { current: Transport } = { current: defaultTransport }
