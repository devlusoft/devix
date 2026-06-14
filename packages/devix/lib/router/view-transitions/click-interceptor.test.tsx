import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClickInterceptor } from './click-interceptor'
import { withViewTransition } from './transition'

const navigate = vi.fn()
const withViewTransitionMock = vi.mocked(withViewTransition)

vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('./transition', () => ({
  withViewTransition: vi.fn((fn: () => void) => fn()),
}))

vi.mock('solid-js', async () => {
  const actual = await vi.importActual<typeof import('solid-js')>('solid-js')
  return {
    ...actual,
    onMount: (fn: () => void) => fn(),
    onCleanup: (fn: () => void) => cleanupFns.push(fn),
  }
})

let cleanupFns: Array<() => void> = []
let clickHandler: ((e: MouseEvent) => void) | undefined
let addEventListenerSpy: ReturnType<typeof vi.fn>
let removeEventListenerSpy: ReturnType<typeof vi.fn>

class FakeAnchorElement {}

function makeEvent(
  overrides: Partial<{
    defaultPrevented: boolean
    button: number
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
    target: HTMLElement | null
  }> = {},
): MouseEvent {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent
}

function makeAnchor(
  overrides: Partial<{
    href: string | null
    target: string
    hasDownload: boolean
    origin: string
  }> = {},
): HTMLAnchorElement {
  const href = overrides.href === undefined ? '/about' : overrides.href
  const anchor: Record<string, unknown> = {
    href: href ?? '',
    target: overrides.target ?? '',
    origin: overrides.origin ?? 'https://example.com',
    hasAttribute: (name: string) => (name === 'download' ? !!overrides.hasDownload : false),
    getAttribute: (name: string) => (name === 'href' ? href : null),
    closest(this: unknown, sel: string) {
      return sel === 'a[href]' ? this : null
    },
  }
  Object.setPrototypeOf(anchor, FakeAnchorElement.prototype)
  return anchor as unknown as HTMLAnchorElement
}

beforeEach(() => {
  vi.resetModules()
  cleanupFns = []
  navigate.mockReset()
  withViewTransitionMock.mockClear()
  clickHandler = undefined
  addEventListenerSpy = vi.fn((_event: string, fn: (e: MouseEvent) => void) => {
    clickHandler = fn
  })
  removeEventListenerSpy = vi.fn()
  vi.stubGlobal('document', {
    addEventListener: addEventListenerSpy,
    removeEventListener: removeEventListenerSpy,
  })
  vi.stubGlobal('window', { location: { origin: 'https://example.com' } })
  ;(globalThis as { HTMLAnchorElement?: unknown }).HTMLAnchorElement = FakeAnchorElement
})

afterEach(() => {
  cleanupFns.forEach((fn) => {
    fn()
  })
  cleanupFns = []
  vi.unstubAllGlobals()
})

function mountInterceptor() {
  void ClickInterceptor({})
  if (!clickHandler) throw new Error('click handler was not registered')
  return clickHandler
}

describe('ClickInterceptor — navigation', () => {
  it('calls navigate with the href wrapped in withViewTransition', () => {
    const handler = mountInterceptor()
    const link = makeAnchor({ href: '/about' })

    handler(makeEvent({ target: link as unknown as HTMLElement }))

    expect(withViewTransitionMock).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/about')
  })

  it('calls preventDefault on the event', () => {
    const handler = mountInterceptor()
    const link = makeAnchor({ href: '/about' })
    const event = makeEvent({ target: link as unknown as HTMLElement })

    handler(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})

describe('ClickInterceptor — guard clauses', () => {
  it('does not intercept when defaultPrevented is true', () => {
    const handler = mountInterceptor()
    const link = makeAnchor()

    handler(makeEvent({ defaultPrevented: true, target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
    expect(withViewTransitionMock).not.toHaveBeenCalled()
  })

  it('does not intercept non-left clicks', () => {
    const handler = mountInterceptor()
    const link = makeAnchor()

    handler(makeEvent({ button: 1, target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it.each([
    'metaKey',
    'ctrlKey',
    'shiftKey',
    'altKey',
  ] as const)('does not intercept when %s is held', (key) => {
    const handler = mountInterceptor()
    const link = makeAnchor()

    handler(makeEvent({ [key]: true, target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept when target is null', () => {
    const handler = mountInterceptor()

    handler(makeEvent({ target: null }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept when target has no anchor ancestor', () => {
    const handler = mountInterceptor()

    handler(
      makeEvent({
        target: { closest: () => null } as unknown as HTMLElement,
      }),
    )

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept when closest match is not an HTMLAnchorElement', () => {
    const handler = mountInterceptor()

    handler(
      makeEvent({
        target: { closest: () => ({}) } as unknown as HTMLElement,
      }),
    )

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept when anchor has no href', () => {
    const handler = mountInterceptor()
    const link = makeAnchor({ href: null })

    handler(makeEvent({ target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept target=_blank', () => {
    const handler = mountInterceptor()
    const link = makeAnchor({ target: '_blank' })

    handler(makeEvent({ target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept download links', () => {
    const handler = mountInterceptor()
    const link = makeAnchor({ hasDownload: true })

    handler(makeEvent({ target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not intercept external links', () => {
    const handler = mountInterceptor()
    const link = makeAnchor({ origin: 'https://other.example.com' })

    handler(makeEvent({ target: link as unknown as HTMLElement }))

    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('ClickInterceptor — lifecycle', () => {
  it('registers a click listener with capture: true on mount', () => {
    mountInterceptor()

    expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), {
      capture: true,
    })
  })

  it('removes the click listener on cleanup', () => {
    mountInterceptor()

    cleanupFns.forEach((fn) => {
      fn()
    })

    expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), {
      capture: true,
    })
  })
})
