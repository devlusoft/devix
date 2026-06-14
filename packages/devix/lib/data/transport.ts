import { deserialize, serialize } from 'seroval'

export type Transport = <R>(id: string, args: unknown[]) => Promise<R>

export const clientTransport: { current: Transport } = {
  current: defaultFetchTransport,
}

async function defaultFetchTransport<R>(id: string, args: unknown[]): Promise<R> {
  const pagePath =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''
  const res = await fetch('/_devix/server', {
    method: 'POST',
    headers: {
      'X-Server-Id': id,
      'X-Page-Path': pagePath,
      'Content-Type': 'application/json',
    },
    body: serialize(args),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`devix: server function "${id}" failed (${res.status}): ${text}`)
  }
  return deserialize(await res.text()) as R
}
