// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {renderToString} from 'react-dom/server'
import {createElement, act} from 'react'
import {createRoot} from 'react-dom/client'
import {useNavigate, useRevalidate} from '../../src/runtime/router-provider'
import {RouterContext} from '../../src/runtime/context'

describe('useNavigate — SSR safety', () => {
    it('no lanza durante SSR (sin RouterProvider)', () => {
        let navigate: unknown
        function Page() {
            navigate = useNavigate()
            return null
        }
        expect(() => renderToString(createElement(Page))).not.toThrow()
        expect(typeof navigate).toBe('function')
    })

    it('el noop de SSR resuelve sin error', async () => {
        let navigate: ReturnType<typeof useNavigate>
        function Page() {
            navigate = useNavigate()
            return null
        }
        renderToString(createElement(Page))
        await expect(navigate!('/test')).resolves.toBeUndefined()
    })
})

describe('useRevalidate — SSR safety', () => {
    it('no lanza durante SSR (sin RouterProvider)', () => {
        let revalidate: unknown
        function Page() {
            revalidate = useRevalidate()
            return null
        }
        expect(() => renderToString(createElement(Page))).not.toThrow()
        expect(typeof revalidate).toBe('function')
    })

    it('el noop de SSR resuelve sin error', async () => {
        let revalidate: ReturnType<typeof useRevalidate>
        function Page() {
            revalidate = useRevalidate()
            return null
        }
        renderToString(createElement(Page))
        await expect(revalidate!()).resolves.toBeUndefined()
    })
})

function makeContextValue(overrides: Record<string, unknown> = {}) {
    return {
        pathname: '/',
        params: {},
        loaderData: null,
        layoutsData: [],
        Page: () => null,
        layouts: [],
        metadata: null,
        isNavigating: false,
        navigate: vi.fn().mockResolvedValue(undefined),
        revalidate: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    } as any
}

describe('useNavigate — dentro de RouterProvider', () => {
    let container: HTMLDivElement

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        document.body.removeChild(container)
    })

    it('retorna la función navigate del contexto', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useNavigate>

        function Page() {
            fn = useNavigate()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        expect(fn!).toBe(ctx.navigate)
    })

    it('pasa options { replace: true } al navegar', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useNavigate>

        function Page() {
            fn = useNavigate()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        await act(async () => { await fn!('/home', {replace: true}) })
        expect(ctx.navigate).toHaveBeenCalledWith('/home', {replace: true})
    })

    it('pasa options { viewTransition: true } al navegar', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useNavigate>

        function Page() {
            fn = useNavigate()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        await act(async () => { await fn!('/home', {viewTransition: true}) })
        expect(ctx.navigate).toHaveBeenCalledWith('/home', {viewTransition: true})
    })
})

describe('useRevalidate — dentro de RouterProvider', () => {
    let container: HTMLDivElement

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        document.body.removeChild(container)
    })

    it('retorna la función revalidate del contexto', async () => {
        const ctx = makeContextValue()
        let fn: ReturnType<typeof useRevalidate>

        function Page() {
            fn = useRevalidate()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        await act(async () => { await fn!() })
        expect(ctx.revalidate).toHaveBeenCalledOnce()
    })
})
