import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasViewTransitions, prefersReducedMotion } from './feature'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hasViewTransitions', () => {
  it('returns false when document is undefined', () => {
    vi.unstubAllGlobals()
    const originalDocument = (globalThis as { document?: unknown }).document
    ;(globalThis as { document?: unknown }).document = undefined
    try {
      expect(hasViewTransitions()).toBe(false)
    } finally {
      ;(globalThis as { document?: unknown }).document = originalDocument
    }
  })

  it('returns false when document.startViewTransition is missing', () => {
    vi.stubGlobal('document', {})
    expect(hasViewTransitions()).toBe(false)
  })

  it('returns true when document.startViewTransition is a function', () => {
    vi.stubGlobal('document', {
      startViewTransition: () => ({ finished: Promise.resolve() }),
    })
    expect(hasViewTransitions()).toBe(true)
  })
})

describe('prefersReducedMotion', () => {
  it('returns false when window is undefined', () => {
    vi.unstubAllGlobals()
    const originalWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = undefined
    try {
      expect(prefersReducedMotion()).toBe(false)
    } finally {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })

  it('returns true when matchMedia reports reduce', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query.includes('reduce') }),
    })
    expect(prefersReducedMotion()).toBe(true)
  })

  it('returns false when matchMedia reports no-preference', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    })
    expect(prefersReducedMotion()).toBe(false)
  })
})
