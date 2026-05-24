// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {render} from 'solid-js/web'
import {Link} from '../../src/runtime/link'
import {RouterContext} from '../../src/runtime/context'

function makeCtx(overrides: Record<string, unknown> = {}) {
    return {
        pathname: '/',
        params: {},
        guardData: null,
        Page: () => null,
        layouts: [],
        metadata: null,
        isNavigating: false,
        navigate: vi.fn().mockResolvedValue(undefined),
        revalidate: vi.fn().mockResolvedValue(undefined),
        prefetchRoute: vi.fn(),
        ...overrides,
    } as any
}

function renderLink(ctx: ReturnType<typeof makeCtx>, props: Record<string, unknown>, container: HTMLDivElement): () => void {
    return render(() => (
        <RouterContext.Provider value={ctx}>
            <Link {...props as any}>link</Link>
        </RouterContext.Provider>
    ), container)
}

describe('Link — prefetch en hover', () => {
    let container: HTMLDivElement
    let dispose: () => void

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
        vi.useFakeTimers()
    })

    afterEach(() => {
        dispose?.()
        document.body.removeChild(container)
        vi.useRealTimers()
    })

    it('llama prefetchRoute después de 50ms de hover', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false, relatedTarget: document.body}))
        expect(ctx.prefetchRoute).not.toHaveBeenCalled()

        vi.advanceTimersByTime(50)
        expect(ctx.prefetchRoute).toHaveBeenCalledOnce()
        expect(ctx.prefetchRoute).toHaveBeenCalledWith('/users/new')
    })

    it('no llama prefetchRoute si mouseLeave ocurre antes de 50ms', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false, relatedTarget: document.body}))
        vi.advanceTimersByTime(30)
        anchor.dispatchEvent(new MouseEvent('mouseleave', {bubbles: false, relatedTarget: document.body}))
        vi.advanceTimersByTime(100)

        expect(ctx.prefetchRoute).not.toHaveBeenCalled()
    })

    it('llama prefetchRoute inmediatamente en touchStart', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new TouchEvent('touchstart', {bubbles: true}))
        expect(ctx.prefetchRoute).toHaveBeenCalledOnce()
        expect(ctx.prefetchRoute).toHaveBeenCalledWith('/users/new')
    })

    it('touchStart cancela el timer de hover antes de disparar', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false, relatedTarget: document.body}))
        vi.advanceTimersByTime(30)
        anchor.dispatchEvent(new TouchEvent('touchstart', {bubbles: true}))
        vi.advanceTimersByTime(100)

        expect(ctx.prefetchRoute).toHaveBeenCalledOnce()
    })

    it('prefetch="none" no llama prefetchRoute en hover', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new', prefetch: 'none'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false, relatedTarget: document.body}))
        vi.advanceTimersByTime(200)

        expect(ctx.prefetchRoute).not.toHaveBeenCalled()
    })

    it('prefetch="none" no llama prefetchRoute en touchStart', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new', prefetch: 'none'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new TouchEvent('touchstart', {bubbles: true}))

        expect(ctx.prefetchRoute).not.toHaveBeenCalled()
    })

    it('hover repetido dispara prefetchRoute en cada ciclo completo', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/users/new'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false, relatedTarget: document.body}))
        vi.advanceTimersByTime(50)
        anchor.dispatchEvent(new MouseEvent('mouseleave', {bubbles: false, relatedTarget: document.body}))

        anchor.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false, relatedTarget: document.body}))
        vi.advanceTimersByTime(50)

        expect(ctx.prefetchRoute).toHaveBeenCalledWith('/users/new')
    })
})

describe('Link — navegación al hacer click', () => {
    let container: HTMLDivElement
    let dispose: () => void

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        dispose?.()
        document.body.removeChild(container)
    })

    it('click izquierdo llama navigate con el href', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/dashboard'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, cancelable: true}))
        expect(ctx.navigate).toHaveBeenCalledWith('/dashboard', {replace: undefined, viewTransition: undefined})
    })

    it('click con metaKey no llama navigate (abrir en nueva pestaña)', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/dashboard'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, metaKey: true}))
        expect(ctx.navigate).not.toHaveBeenCalled()
    })

    it('click con ctrlKey no llama navigate', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/dashboard'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, ctrlKey: true}))
        expect(ctx.navigate).not.toHaveBeenCalled()
    })

    it('click con shiftKey no llama navigate', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/dashboard'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, shiftKey: true}))
        expect(ctx.navigate).not.toHaveBeenCalled()
    })

    it('click con botón 1 (middle click) no llama navigate', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/dashboard'}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 1}))
        expect(ctx.navigate).not.toHaveBeenCalled()
    })

    it('replace=true pasa { replace: true } a navigate', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/login', replace: true}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, cancelable: true}))
        expect(ctx.navigate).toHaveBeenCalledWith('/login', {replace: true, viewTransition: undefined})
    })

    it('viewTransition=true pasa { viewTransition: true } a navigate', () => {
        const ctx = makeCtx()
        dispose = renderLink(ctx, {href: '/profile', viewTransition: true}, container)
        const anchor = container.querySelector('a')!

        anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, cancelable: true}))
        expect(ctx.navigate).toHaveBeenCalledWith('/profile', {replace: undefined, viewTransition: true})
    })
})
