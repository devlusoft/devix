import { describe, expect, it } from 'vitest'
import type { ResolvedDevixConfig } from '../config/define-config'
import { preset } from './preset'

const baseConfig: ResolvedDevixConfig = {
  outDir: 'dist',
  base: '/',
  vite: {},
}

describe('preset', () => {
  it('should include devix plugins (router and server)', () => {
    const result = preset(baseConfig)
    const names = (result.plugins ?? [])
      .filter((p): p is { name: string } => Boolean(p))
      .map((p) => p.name)
    expect(names).toContain('devix:router')
    expect(names).toContain('devix:server')
  })

  it('should set outDir from config', () => {
    const result = preset({ ...baseConfig, outDir: 'build' })
    expect(result.build?.outDir).toBe('build')
  })

  it('should set base from config', () => {
    const result = preset({ ...baseConfig, base: '/app/' })
    expect(result.base).toBe('/app/')
  })
})
