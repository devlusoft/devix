import { describe, expect, it } from 'vitest'
import type { ResolvedDevixConfig } from '../config/define-config'
import { preset } from './preset'

const baseConfig: ResolvedDevixConfig = {
  outDir: 'dist',
  base: '/',
  port: 3000,
  host: '0.0.0.0',
  output: 'server',
  vite: {},
}

describe('preset', () => {
  it('should include devix plugins (router, server, and data transform)', () => {
    const result = preset(baseConfig)
    const names = (result.plugins ?? [])
      .filter((p): p is { name: string } => Boolean(p))
      .map((p) => p.name)
    expect(names).toContain('devix:router')
    expect(names).toContain('devix:server')
    expect(names).toContain('devix:data-transform')
  })

  it('should set outDir from config', () => {
    const result = preset({ ...baseConfig, outDir: 'build' })
    expect(result.build?.outDir).toBe('build')
  })

  it('should set base from config', () => {
    const result = preset({ ...baseConfig, base: '/app/' })
    expect(result.base).toBe('/app/')
  })

  it('should set appType to custom', () => {
    const result = preset(baseConfig)
    expect(result.appType).toBe('custom')
  })
})

describe('preset (build)', () => {
  it('configures client + ssr environments', () => {
    const result = preset(baseConfig, 'build')
    expect(result.environments?.client?.build?.outDir).toBe('dist/client')
    expect(result.environments?.ssr?.build?.outDir).toBe('dist/server')
    expect(result.environments?.ssr?.build?.ssr).toBe(true)
  })

  it('does not include devixServer plugin in build', () => {
    const result = preset(baseConfig, 'build')
    const names = (result.plugins ?? [])
      .filter((p): p is { name: string } => Boolean(p))
      .map((p) => p.name)
    expect(names).not.toContain('devix:server')
  })

  it('configures manifest and hashed assets in client environment', () => {
    const result = preset(baseConfig, 'build')
    expect(result.environments?.client?.build?.manifest).toBe(true)
    const output = result.environments?.client?.build?.rolldownOptions?.output as
      | { entryFileNames?: string }
      | undefined
    expect(output?.entryFileNames).toBe('assets/[name]-[hash].js')
  })
})
