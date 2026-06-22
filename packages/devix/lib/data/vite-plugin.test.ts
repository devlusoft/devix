import { describe, it, expect } from 'vitest'
import { dataTransform } from './vite-plugin.js'

async function runTransform(
  plugin: ReturnType<typeof dataTransform>,
  code: string,
  id: string,
) {
  const transform = plugin.transform as (
    this: unknown,
    code: string,
    id: string,
  ) => Promise<{ code: string; map: null } | null> | null
  return transform.call({}, code, id)
}

function setSsr(plugin: ReturnType<typeof dataTransform>, ssr: boolean) {
  ;(plugin.configResolved as (this: unknown, config: { build: { ssr: boolean } }) => void).call(
    {},
    { build: { ssr } },
  )
}

describe('dataTransform', () => {
  it('skips files in node_modules', async () => {
    const plugin = dataTransform()
    const result = await runTransform(plugin, 'export const x = action(() => 1)', '/foo/node_modules/bar.ts')
    expect(result).toBeNull()
  })

  it('skips files without action() calls', async () => {
    const plugin = dataTransform()
    const result = await runTransform(plugin, 'export const x = 1', '/foo/bar.ts')
    expect(result).toBeNull()
  })

  it('rewrites action() to devixAction in SSR mode', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `export const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts')
    expect(result).not.toBeNull()
    expect(result!.code).toContain('devixAction(')
    expect(result!.code).toMatch(/action:[a-f0-9]{16}/)
  })

  it('rewrites action() to devixActionClient in client mode (strips fn body)', async () => {
    const plugin = dataTransform()
    setSsr(plugin, false)
    const code = `export const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts')
    expect(result).not.toBeNull()
    expect(result!.code).toContain('devixActionClient(')
    expect(result!.code).not.toContain('n * 2')
    expect(result!.code).toMatch(/action:[a-f0-9]{16}/)
  })

  it('id is identical between SSR and client builds', async () => {
    const ssrPlugin = dataTransform()
    const clientPlugin = dataTransform()
    setSsr(ssrPlugin, true)
    setSsr(clientPlugin, false)
    const code = `export const myAction = action(async (n) => n * 2)`
    const ssrResult = await runTransform(ssrPlugin, code, '/foo/bar.ts')
    const clientResult = await runTransform(clientPlugin, code, '/foo/bar.ts')
    const ssrId = ssrResult!.code.match(/action:[a-f0-9]{16}/)![0]
    const clientId = clientResult!.code.match(/action:[a-f0-9]{16}/)![0]
    expect(ssrId).toBe(clientId)
  })

  it('injects the import statement when not present', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `export const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts')
    expect(result!.code).toContain(`from '@devlusoft/devix/data/internal'`)
  })

  it('does not duplicate the import statement when already present', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `import { action } from '@devlusoft/devix'\nexport const myAction = action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts')
    const matches = result!.code.match(/@devlusoft\/devix\/data\/internal/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('handles export default action()', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `export default action(async (n) => n * 2)`
    const result = await runTransform(plugin, code, '/foo/bar.ts')
    expect(result!.code).toContain('devixAction(')
    expect(result!.code).toMatch(/action:[a-f0-9]{16}/)
  })

  it('returns null on unparseable input', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `this is not valid typescript @#$%^&*`
    const result = await runTransform(plugin, code, '/foo/bar.ts')
    expect(result).toBeNull()
  })

  it('id is deterministic for same filepath+exportName', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `export const myAction = action(async (n) => n * 2)`
    const r1 = await runTransform(plugin, code, '/foo/bar.ts')
    const r2 = await runTransform(plugin, code, '/foo/bar.ts')
    const id1 = r1!.code.match(/action:[a-f0-9]{16}/)![0]
    const id2 = r2!.code.match(/action:[a-f0-9]{16}/)![0]
    expect(id1).toBe(id2)
  })

  it('different filepaths produce different ids', async () => {
    const plugin = dataTransform()
    setSsr(plugin, true)
    const code = `export const myAction = action(async (n) => n * 2)`
    const r1 = await runTransform(plugin, code, '/foo/bar.ts')
    const r2 = await runTransform(plugin, code, '/foo/baz.ts')
    const id1 = r1!.code.match(/action:[a-f0-9]{16}/)![0]
    const id2 = r2!.code.match(/action:[a-f0-9]{16}/)![0]
    expect(id1).not.toBe(id2)
  })
})
