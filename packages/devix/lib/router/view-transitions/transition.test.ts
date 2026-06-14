import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withViewTransition } from './transition'

const { hasViewTransitionsMock, prefersReducedMotionMock } = vi.hoisted(() => ({
  hasViewTransitionsMock: vi.fn(),
  prefersReducedMotionMock: vi.fn(),
}))

vi.mock('./feature', () => ({
  hasViewTransitions: hasViewTransitionsMock,
  prefersReducedMotion: prefersReducedMotionMock,
}))

beforeEach(() => {
  hasViewTransitionsMock.mockReset()
  prefersReducedMotionMock.mockReset()
  prefersReducedMotionMock.mockReturnValue(false)
})

describe('withViewTransition', () => {
  it('runs the callback directly when prefers-reduced-motion is reduce', async () => {
    prefersReducedMotionMock.mockReturnValue(true)
    hasViewTransitionsMock.mockReturnValue(true)

    const cb = vi.fn()
    await withViewTransition(cb)

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('runs the callback directly when the browser does not support startViewTransition', async () => {
    hasViewTransitionsMock.mockReturnValue(false)

    const cb = vi.fn()
    await withViewTransition(cb)

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('wraps the callback with document.startViewTransition when supported', async () => {
    hasViewTransitionsMock.mockReturnValue(true)

    const startViewTransition = vi.fn((fn: () => void) => {
      fn()
      return { finished: Promise.resolve() }
    })
    vi.stubGlobal('document', { startViewTransition })

    const cb = vi.fn()
    await withViewTransition(cb)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('resolves when the startViewTransition finished promise resolves', async () => {
    hasViewTransitionsMock.mockReturnValue(true)

    let resolveFinish: (() => void) | undefined
    const startViewTransition = vi.fn((fn: () => void) => {
      fn()
      return {
        finished: new Promise<void>((r) => {
          resolveFinish = r
        }),
      }
    })
    vi.stubGlobal('document', { startViewTransition })

    const cb = vi.fn()
    const promise = withViewTransition(cb)
    resolveFinish?.()
    await promise
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('still resolves when startViewTransition finished promise rejects', async () => {
    hasViewTransitionsMock.mockReturnValue(true)

    vi.stubGlobal('document', {
      startViewTransition: (fn: () => void) => {
        fn()
        return { finished: Promise.reject(new Error('boom')) }
      },
    })

    const cb = vi.fn()
    await expect(withViewTransition(cb)).resolves.toBeUndefined()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
