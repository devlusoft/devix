export type Transport = <R>(id: string, args: unknown[]) => Promise<R>

export const clientTransport: { current: Transport } = {
  current: defaultFetchTransport,
}

async function defaultFetchTransport<R>(id: string, args: unknown[]): Promise<R> {
  const seroval = await import('seroval')
  const res = await fetch('/_devix/server', {
    method: 'POST',
    headers: {
      'X-Server-Id': id,
      'Content-Type': 'application/json',
    },
    body: seroval.serialize(args),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`devix: server function "${id}" failed (${res.status}): ${text}`)
  }
  return seroval.deserialize(await res.text()) as R
}
