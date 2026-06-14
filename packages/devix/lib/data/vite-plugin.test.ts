import { describe, expect, it } from 'vitest'
import { dataTransform } from './vite-plugin'

type TransformFn = (this: { environment?: { name: string } }, code: string, id: string) => unknown
type TransformHook = TransformFn | { handler: TransformFn; order?: 'pre' | 'post' | null }
type BoundTransform = (code: string, id: string) => unknown

function getTransformHook(env: 'ssr' | 'client' = 'client'): BoundTransform {
  const plugin = dataTransform() as unknown as {
    name: string
    transform: TransformHook
    configResolved?: (config: { root: string }) => void
  }
  expect(plugin.name).toBe('devix:data-transform')

  plugin.configResolved?.({ root: '/Users/dev/project' })

  const hook = plugin.transform
  const fn: TransformFn = typeof hook === 'function' ? hook : hook.handler

  return fn.bind({ environment: { name: env } }) as BoundTransform
}

describe('dataTransform — server (keeps implementations)', () => {
  it('does not transform query calls', () => {
    const transform = getTransformHook('ssr')
    const src = `export const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts')

    expect(result).toBeNull()
  })

  it('rewrites action(fn) to devixAction(id, fn)', () => {
    const transform = getTransformHook('ssr')
    const src = `export const renameUser = action((id, fd) => db.update(id, fd))\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as {
      code: string
    }

    expect(result.code).toContain('devixAction')
    expect(result.code).not.toContain('action(')
    expect(result.code).toContain('db.update')
  })
})

describe('dataTransform — client (strips implementations)', () => {
  it('replaces the callback body with an RPC stub for query', () => {
    const transform = getTransformHook('client')
    const src = `export const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as {
      code: string
    }

    expect(result.code).toContain('query(')
    expect(result.code).toContain("'get-user'")
    expect(result.code).toContain('clientTransport')
    expect(result.code).not.toContain('db.users.find')
  })

  it('rewrites action(fn) to devixActionClient(id)', () => {
    const transform = getTransformHook('client')
    const src = `export const renameUser = action((id, fd) => db.update(id, fd))\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as {
      code: string
    }

    expect(result.code).toContain('devixActionClient')
    expect(result.code).not.toContain('action(')
    expect(result.code).not.toContain('db.update')
  })

  it('preserves the query name', () => {
    const transform = getTransformHook('client')
    const src = `export const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as { code: string }

    expect(result.code).toContain("'get-user'")
  })

  it('returns null when there are no query/action calls', () => {
    const transform = getTransformHook('client')
    const src = `const x = 1\nconst y = (a) => a * 2\n`

    const result = transform(src, '/Users/dev/project/app/data/x.ts')

    expect(result).toBeNull()
  })

  it('returns null for files in node_modules', () => {
    const transform = getTransformHook('client')
    const src = `export const fn = query(() => 1, 'name')\n`

    const result = transform(src, '/Users/dev/project/node_modules/some-pkg/index.ts')

    expect(result).toBeNull()
  })

  it('does not crash on unparseable input', () => {
    const transform = getTransformHook('client')
    const src = `export const fn = query((id) => {, 'broken'\n`

    expect(() => transform(src, '/Users/dev/project/app/data/x.ts')).not.toThrow()
  })
})
