import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from './load-config'

let cwd: string

beforeEach(async () => {
  cwd = join(tmpdir(), `devix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(cwd, { recursive: true })
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('should return defaults when no config file exists', async () => {
    const config = await loadConfig(cwd)
    expect(config.outDir).toBe('dist')
    expect(config.base).toBe('/')
  })

  it("should load user's devix.config.ts", async () => {
    await writeFile(join(cwd, 'devix.config.ts'), `export default { outDir: 'build' }`)
    const config = await loadConfig(cwd)
    expect(config.outDir).toBe('build')
  })

  it('should apply defaults for missing fields', async () => {
    await writeFile(join(cwd, 'devix.config.ts'), `export default { base: '/app/' }`)
    const config = await loadConfig(cwd)
    expect(config.base).toBe('/app/')
    expect(config.outDir).toBe('dist')
  })

  it('should pass through vite config', async () => {
    await writeFile(
      join(cwd, 'devix.config.ts'),
      `export default { vite: { resolve: { alias: { '@': './src' } } } }`,
    )
    const config = await loadConfig(cwd)
    expect(config.vite.resolve?.alias).toEqual({ '@': './src' })
  })
})
