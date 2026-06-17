import { decode } from 'turbo-stream'
import { collectEncode } from '../utils/turbo-serializer.js'
import { getServerFn } from './server-registry.js'
import { runWithRequestEvent, type RouterEvent } from './request-context.js'

function stringToStream(s: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(s)
      controller.close()
    },
  })
}

export interface ServerFnResponse {
  status: number
  body: string
  headers?: Record<string, string>
}

export async function handleServerFunction(
  request: Request,
  respond: (r: ServerFnResponse) => void,
  createEvent: () => RouterEvent,
): Promise<void> {
  const id = request.headers.get('X-Server-Id')
  if (!id) {
    respond({ status: 400, body: JSON.stringify({ error: 'Missing X-Server-Id' }) })
    return
  }
  const meta = getServerFn(id)
  if (!meta) {
    respond({ status: 500, body: JSON.stringify({ error: `Unknown server fn: ${id}` }) })
    return
  }
  try {
    const bodyText = await request.text()
    const args = (await decode(stringToStream(bodyText))) as unknown[]
    const result = await runWithRequestEvent(createEvent(), () => meta.fn(...args))
    const body = await collectEncode(result)
    respond({ status: 200, body })
  } catch (e) {
    console.error('[devix] server fn failed:', id, e)
    respond({
      status: 500,
      body: JSON.stringify({ error: String((e as Error)?.message ?? e) }),
    })
  }
}
