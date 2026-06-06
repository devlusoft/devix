import { describe, expect, it } from 'vitest'
import { parseCommand } from './index'

describe('parseCommand', () => {
  it('should return "dev" for argv ["dev"]', () => {
    expect(parseCommand(['dev'])).toBe('dev')
  })

  it('should return "build" for argv ["build"]', () => {
    expect(parseCommand(['build'])).toBe('build')
  })

  it('should default to "dev" on empty argv', () => {
    expect(parseCommand([])).toBe('dev')
  })

  it('should throw on unknown command', () => {
    expect(() => parseCommand(['preview'])).toThrow(/unknown/i)
  })
})
