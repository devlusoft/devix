import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig, loadRuntimeConfig } from './load-config'

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

describe('loadRuntimeConfig', () => {
  it('returns defaults when dist/devix.config.json is missing', () => {
    const cfg = loadRuntimeConfig(cwd)
    expect(cfg.port).toBe(3000)
    expect(cfg.host).toBe('0.0.0.0')
    expect(cfg.output).toBe('server')
  })

  it('reads port/host/output from dist/devix.config.json', async () => {
    await writeFile(
      join(cwd, 'devix.config.json'),
      JSON.stringify({ port: 8080, host: '127.0.0.1', output: 'server' }),
    )
    const cfg = loadRuntimeConfig(cwd)
    expect(cfg.port).toBe(8080)
    expect(cfg.host).toBe('127.0.0.1')
    expect(cfg.output).toBe('server')
  })

  it('falls back to defaults for partial configs', async () => {
    await writeFile(join(cwd, 'devix.config.json'), JSON.stringify({ port: 4000 }))
    const cfg = loadRuntimeConfig(cwd)
    expect(cfg.port).toBe(4000)
    expect(cfg.host).toBe('0.0.0.0')
  })
})

describe('loadConfig — new fields', () => {
  it('resolves port/host/output from user config', async () => {
    await writeFile(
      join(cwd, 'devix.config.ts'),
      `export default { port: 4000, host: 'localhost', output: 'server' }`,
    )
    const config = await loadConfig(cwd)
    expect(config.port).toBe(4000)
    expect(config.host).toBe('localhost')
    expect(config.output).toBe('server')
  })

  it('falls back to defaults when port/host/output are missing', async () => {
    const config = await loadConfig(cwd)
    expect(config.port).toBe(3000)
    expect(config.host).toBe(true)
    expect(config.output).toBe('server')
  })
})
