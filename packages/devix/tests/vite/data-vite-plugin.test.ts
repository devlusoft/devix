import { describe, it, expect } from 'vitest'
import { dataTransform } from '../../lib/data/vite-plugin'

async function runTransform(
  plugin: ReturnType<typeof dataTransform>,
  code: string,
  id: string,
  ssr: boolean,
) {
  const transform = plugin.transform as (
    this: unknown,
    code: string,
    id: string,
    options?: { ssr?: boolean },
  ) => Promise<{ code: string; map: null } | null> | null
  return transform.call({}, code, id, { ssr })
}

describe('dataTransform — action()', () => {
  it('skips files in node_modules', async () => {
    const plugin = dataTransform()
    const result = await runTransform(
      plugin,
      'export const x = action(() => 1)',
      '/foo/node_modules/bar.ts',
      false,
    )
    expect(result).toBeNull()
  })

  it('skips files without action() calls', async () => {
    const plugin = dataTransform()
    const result = await runTransform(plugin, 'export const x = 1', '/foo/bar.ts', false)
    expect(result).toBeNull()
  })

  it('rewrites action() to devixAction in SSR mode', async () => {
    const plugin = dataTransform()
    const code = `export const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result).not.toBeNull()
    expect(result!.code).toContain('devixAction(')
    expect(result!.code).toMatch(/action:[a-f0-9]{16}/)
  })

  it('rewrites action() to devixActionClient in client mode (strips fn body)', async () => {
    const plugin = dataTransform()
    const code = `export const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result).not.toBeNull()
    expect(result!.code).toContain('devixActionClient(')
    expect(result!.code).not.toContain('n * 2')
    expect(result!.code).toMatch(/action:[a-f0-9]{16}/)
  })

  it('action id is identical between SSR and client builds', async () => {
    const ssrPlugin = dataTransform()
    const clientPlugin = dataTransform()
    const code = `export const myAction = action(async (n) => n * 2)`
    const ssrResult = await runTransform(ssrPlugin, code, '/foo/bar.ts', true)
    const clientResult = await runTransform(clientPlugin, code, '/foo/bar.ts', false)
    const ssrId = ssrResult!.code.match(/action:[a-f0-9]{16}/)![0]
    const clientId = clientResult!.code.match(/action:[a-f0-9]{16}/)![0]
    expect(ssrId).toBe(clientId)
  })

  it('injects the server import when not present in SSR mode', async () => {
    const plugin = dataTransform()
    const code = `export const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result!.code).toContain(`from '@devlusoft/devix/data/internal/server'`)
  })

  it('does not duplicate the import statement when already present', async () => {
    const plugin = dataTransform()
    const code = `import { action } from '@devlusoft/devix'\nexport const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    const matches = result!.code.match(/@devlusoft\/devix\/data\/internal/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('handles export default action()', async () => {
    const plugin = dataTransform()
    const code = `export default action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result!.code).toContain('devixAction(')
    expect(result!.code).toMatch(/action:[a-f0-9]{16}/)
  })

  it('returns null on unparseable input', async () => {
    const plugin = dataTransform()
    const code = `this is not valid typescript @#$%^&*`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result).toBeNull()
  })

  it('action id is deterministic for same filepath+exportName', async () => {
    const plugin = dataTransform()
    const code = `export const myAction = action(async (n) => n * 2)`
    const r1 = await runTransform(plugin, code, '/foo/bar.ts', true)
    const r2 = await runTransform(plugin, code, '/foo/bar.ts', true)
    const id1 = r1!.code.match(/action:[a-f0-9]{16}/)![0]
    const id2 = r2!.code.match(/action:[a-f0-9]{16}/)![0]
    expect(id1).toBe(id2)
  })

  it('different filepaths produce different action ids', async () => {
    const plugin = dataTransform()
    const code = `export const myAction = action(async (n) => n * 2)`
    const r1 = await runTransform(plugin, code, '/foo/bar.ts', true)
    const r2 = await runTransform(plugin, code, '/foo/baz.ts', true)
    const id1 = r1!.code.match(/action:[a-f0-9]{16}/)![0]
    const id2 = r2!.code.match(/action:[a-f0-9]{16}/)![0]
    expect(id1).not.toBe(id2)
  })
})

describe('dataTransform — query()', () => {
  it('leaves query() untouched in SSR mode', async () => {
    const plugin = dataTransform()
    const code = `export const getPost = query(async (id) => db.posts.find(id), 'get-post')`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result).toBeNull()
  })

  it('rewrites query(fn, name) to clientQuery(name) in client mode', async () => {
    const plugin = dataTransform()
    const code = `export const getPost = query(async (id) => db.posts.find(id), 'get-post')`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result).not.toBeNull()
    expect(result!.code).toContain('clientQuery(')
    expect(result!.code).toContain('get-post')
    expect(result!.code).not.toContain('db.posts.find')
    expect(result!.code).not.toContain('query(')
  })

  it('strips the query fn body so the bundler can tree-shake it', async () => {
    const plugin = dataTransform()
    const code = `
import { db } from './db'
export const getPost = query(async (id) => db.posts.find(id), 'get-post')
`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result!.code).toContain('clientQuery(')
    expect(result!.code).not.toContain('async')
    expect(result!.code).not.toContain('db.posts.find')
  })

  it('preserves the literal name string verbatim in the rewritten call', async () => {
    const plugin = dataTransform()
    const code = `export const listUsers = query(async () => [], 'list-users')`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result!.code).toContain('clientQuery("list-users")')
  })

  it('injects the client import once when query is the only data primitive', async () => {
    const plugin = dataTransform()
    const code = `export const getPost = query(async () => null, 'get-post')`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result!.code).toContain(`from '@devlusoft/devix/data/internal/client'`)
    expect(result!.code).toContain('clientQuery')
    const matches = result!.code.match(/@devlusoft\/devix\/data\/internal\/client/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('does not duplicate the import when query already imports from internal/client', async () => {
    const plugin = dataTransform()
    const code = `
import { clientQuery } from '@devlusoft/devix/data/internal/client'
export const getPost = query(async () => null, 'get-post')
`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    const matches = result!.code.match(/@devlusoft\/devix\/data\/internal\/client/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('does not modify query() in SSR mode (no client import)', async () => {
    const plugin = dataTransform()
    const code = `export const getPost = query(async () => null, 'get-post')`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result).toBeNull()
  })

  it('rewrites multiple query() calls in the same file', async () => {
    const plugin = dataTransform()
    const code = `
export const getPost = query(async () => null, 'get-post')
export const listUsers = query(async () => [], 'list-users')
`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result!.code).toContain('clientQuery("get-post")')
    expect(result!.code).toContain('clientQuery("list-users")')
  })

  it('skips query() calls where the name is not a string literal', async () => {
    const plugin = dataTransform()
    const code = `export const getPost = query(async () => null, name)`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result).toBeNull()
  })

  it('skips query() calls with wrong arity', async () => {
    const plugin = dataTransform()
    const code = `export const getPost = query('get-post')`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result).toBeNull()
  })
})

describe('dataTransform — action() + query() in same file', () => {
  it('handles both primitives in client mode with one client import', async () => {
    const plugin = dataTransform()
    const code = `
export const myAction = action(async (n) => n * 2)
export const getPost = query(async () => null, 'get-post')
`
    const result = await runTransform(plugin, code, '/foo/bar.ts', false)
    expect(result!.code).toContain('devixActionClient(')
    expect(result!.code).toContain('clientQuery("get-post")')
    const matches = result!.code.match(/@devlusoft\/devix\/data\/internal\/client/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('handles both primitives in SSR mode with server import only', async () => {
    const plugin = dataTransform()
    const code = `
export const myAction = action(async (n) => n * 2)
export const getPost = query(async () => null, 'get-post')
`
    const result = await runTransform(plugin, code, '/foo/bar.ts', true)
    expect(result!.code).toContain('devixAction(')
    expect(result!.code).toContain('query(')
    expect(result!.code).toContain("'get-post'")
    expect(result!.code).toContain(`from '@devlusoft/devix/data/internal/server'`)
    expect(result!.code).not.toContain(`from '@devlusoft/devix/data/internal/client'`)
  })
})