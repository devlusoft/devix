import { deserialize, serialize } from 'seroval'
import { createRequestEvent, runWithRequestEvent } from './request-context'
import { getServerFn } from './server-registry'

export async function handleServerFunction(
  req: NodeJS.ReadableStream & {
    url?: string
    method?: string
    headers: Record<string, string | string[] | undefined>
  },
  res: {
    statusCode: number
    setHeader: (k: string, v: string) => void
    end: (chunk?: string) => void
  },
  server: { ssrFixStacktrace: (err: Error) => void },
): Promise<void> {
  const idHeader = req.headers['x-server-id']
  const id = Array.isArray(idHeader) ? idHeader[0] : idHeader
  if (!id) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('devix: missing X-Server-Id header')
    return
  }

  const body = await readBody(req)
  const event = createRequestEvent(req.url ?? '/')

  try {
    const fn = getServerFn(id)
    const args = deserialize(body) as unknown[]
    const result = await runWithRequestEvent(event, () => fn(...args))
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(serialize(result))
  } catch (err) {
    server.ssrFixStacktrace(err as Error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end((err as Error).message)
  }
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
