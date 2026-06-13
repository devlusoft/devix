import { describe, expect, it } from 'vitest'
import { dataTransform } from './vite-plugin'

type TransformFn = (this: { environment?: { name: string } }, code: string, id: string) => unknown
type TransformHook = TransformFn | { handler: TransformFn; order?: 'pre' | 'post' | null }
type BoundTransform = (code: string, id: string) => unknown

function getTransformHook(env: 'ssr' | 'client' = 'client'): BoundTransform {
  const plugin = dataTransform() as unknown as { name: string; transform: TransformHook }
  expect(plugin.name).toBe('devix:data-transform')

  const hook = plugin.transform
  const fn: TransformFn = typeof hook === 'function' ? hook : hook.handler

  return fn.bind({ environment: { name: env } }) as BoundTransform
}

describe('dataTransform — server (skips transform)', () => {
  it('returns null for query calls on the server bundle', () => {
    const transform = getTransformHook('ssr')
    const src = `export const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts')

    expect(result).toBeNull()
  })
})

describe('dataTransform — client (replaces callback with undefined)', () => {
  it('replaces the callback body with undefined for query', () => {
    const transform = getTransformHook('client')
    const src = `export const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as {
      code: string
      map: unknown
    }

    expect(result.code).toContain("query(undefined, 'get-user')")
    expect(result.code).not.toContain('db.users.find')
  })

  it('replaces the callback body with undefined for action', () => {
    const transform = getTransformHook('client')
    const src = `export const renameUser = action((id, fd) => db.update(id, fd), 'rename-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as {
      code: string
      map: unknown
    }

    expect(result.code).toContain("action(undefined, 'rename-user')")
    expect(result.code).not.toContain('db.update')
  })

  it('preserves the query name (the second argument)', () => {
    const transform = getTransformHook('client')
    const src = `export const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as { code: string }

    expect(result.code).toContain("'get-user'")
  })

  it('handles callbacks with multiple statements (block bodies)', () => {
    const transform = getTransformHook('client')
    const src = [
      `export const fn = action(async (id) => {`,
      `  const x = compute(id)`,
      `  await save(x)`,
      `  return x`,
      `}, 'do-work')`,
      ``,
    ].join('\n')

    const result = transform(src, '/Users/dev/project/app/data/x.ts') as { code: string }

    expect(result.code).toContain("action(undefined, 'do-work')")
    expect(result.code).not.toContain('compute(')
    expect(result.code).not.toContain('save(')
  })

  it('handles callbacks with template literals containing commas (regex would break)', () => {
    const transform = getTransformHook('client')
    const src = `export const fn = query(() => \`a, b, c\`, 'with-commas')\n`

    const result = transform(src, '/Users/dev/project/app/data/x.ts') as { code: string }

    expect(result.code).toContain("query(undefined, 'with-commas')")
    expect(result.code).not.toContain('a, b, c')
  })

  it('handles callbacks with nested parens containing commas (regex would break)', () => {
    const transform = getTransformHook('client')
    const src = `export const fn = query((a, b) => f(a, b), 'nested')\n`

    const result = transform(src, '/Users/dev/project/app/data/x.ts') as { code: string }

    expect(result.code).toContain("query(undefined, 'nested')")
    expect(result.code).not.toContain('f(a, b)')
  })

  it('handles a file with multiple top-level queries', () => {
    const transform = getTransformHook('client')
    const src = [
      `export const getUser = query((id) => db.users.find(id), 'get-user')`,
      `export const listUsers = query(() => db.users.all(), 'list-users')`,
      ``,
    ].join('\n')

    const result = transform(src, '/Users/dev/project/app/data/users.ts') as { code: string }

    expect(result.code).toContain("query(undefined, 'get-user')")
    expect(result.code).toContain("query(undefined, 'list-users')")
    expect(result.code).not.toContain('db.users.find')
    expect(result.code).not.toContain('db.users.all')
  })

  it('returns null when there are no query/action calls (pre-check)', () => {
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

  it('does not crash on unparseable input (try/catch)', () => {
    const transform = getTransformHook('client')
    const src = `export const fn = query((id) => {, 'broken'\n`

    expect(() => transform(src, '/Users/dev/project/app/data/x.ts')).not.toThrow()
  })

  it('returns null for non-exported declarations (documented limitation)', () => {
    const transform = getTransformHook('client')
    const src = `const getUser = query((id) => db.users.find(id), 'get-user')\n`

    const result = transform(src, '/Users/dev/project/app/data/users.ts')

    expect(result).toBeNull()
  })
})
