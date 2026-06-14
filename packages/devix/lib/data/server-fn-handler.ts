import { deserialize, serialize } from 'seroval'
import { createRequestEvent, runWithRequestEvent } from './request-context'
import { getServerFn } from './server-registry'

export type ServerFnResponse = {
  status: number
  headers: Headers
  body: string
}

export async function handleServerFunction(
  req: Request,
  respond: (response: ServerFnResponse) => void,
): Promise<void> {
  const id = req.headers.get('x-server-id')
  if (!id) {
    respond(errorResponse(400, 'devix: missing X-Server-Id header'))
    return
  }

  let body: string
  try {
    body = await req.text()
  } catch (err) {
    respond(errorResponse(400, `devix: failed to read body: ${(err as Error).message}`))
    return
  }

  const event = createRequestEvent(req.url)

  try {
    const { fn } = getServerFn(id)
    const args = deserialize(body) as unknown[]
    const result = await runWithRequestEvent(event, () => fn(...args))
    respond({
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      body: serialize(result),
    })
  } catch (err) {
    respond({
      status: 500,
      headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      body: (err as Error).message,
    })
  }
}

function errorResponse(status: number, message: string): ServerFnResponse {
  return {
    status,
    headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
    body: message,
  }
}
