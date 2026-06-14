import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Routes from 'virtual:devix-routes'
import { createRenderFn } from '@devlusoft/devix'
import Root from '/app/root.tsx'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getClientEntry(): string {
  const manifestPath = join(__dirname, '../client/.vite/manifest.json')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      { file: string; isEntry?: boolean }
    >
    for (const chunk of Object.values(manifest)) {
      if (chunk.isEntry) return `/${chunk.file}`
    }
  } catch {}
  return '/_build/entry-client.js'
}

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { stream, getHeaders, getStatus } = createRenderFn(
    Root,
    Routes,
    url.pathname,
    getClientEntry(),
  )

  const { readable, writable } = new TransformStream()
  stream.pipeTo(writable)

  return new Response(readable, {
    status: getStatus(),
    headers: getHeaders(),
  })
}
