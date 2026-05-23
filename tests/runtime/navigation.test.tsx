// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {render} from 'solid-js/web'
import {useNavigate, useRevalidate} from '../../src/runtime'
import {RouterContext} from '../../src/runtime/context'

describe('useNavigate — SSR safety', () => {
    it('retorna noop sin RouterProvider', () => {
        const navigate = useNavigate()
        expect(typeof navigate).toBe('function')
    })

    it('el noop resuelve sin error', async () => {
        const navigate = useNavigate()
        await expect(navigate('/test')).resolves.toBeUndefined()
    })
})

describe('useRevalidate — SSR safety', () => {
    it('retorna noop sin RouterProvider', () => {
        const revalidate = useRevalidate()
        expect(typeof revalidate).toBe('function')
    })

    it('el noop resuelve sin error', async () => {
        const revalidate = useRevalidate()
        await expect(revalidate()).resolves.toBeUndefined()
    })
})

function makeContextValue(overrides: Record<string, unknown> = {}) {
    return {
        pathname: '/',
        params: {},
        loaderData: null,
        layoutsData: [],
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

describe('useNavigate — dentro de RouterProvider', () => {
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

    it('retorna la función navigate del contexto', () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useNavigate>

        function Page() {
            fn = useNavigate()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        expect(fn!).toBe(ctx.navigate)
    })

    it('pasa options { replace: true } al navegar', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useNavigate>

        function Page() {
            fn = useNavigate()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        await fn!('/home', {replace: true})
        expect(ctx.navigate).toHaveBeenCalledWith('/home', {replace: true})
    })

    it('pasa options { viewTransition: true } al navegar', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useNavigate>

        function Page() {
            fn = useNavigate()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        await fn!('/home', {viewTransition: true})
        expect(ctx.navigate).toHaveBeenCalledWith('/home', {viewTransition: true})
    })
})

describe('useRevalidate — dentro de RouterProvider', () => {
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

    it('retorna la función revalidate del contexto', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useRevalidate>

        function Page() {
            fn = useRevalidate()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        await fn!()
        expect(ctx.revalidate).toHaveBeenCalledOnce()
    })
})
