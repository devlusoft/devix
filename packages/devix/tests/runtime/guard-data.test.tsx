// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {renderToString} from 'react-dom/server'
import {createElement, act} from 'react'
import {createRoot} from 'react-dom/client'
import {useGuardData} from '../../lib/runtime'
import {RouterContext} from '../../lib/runtime/context'

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

describe('useGuardData — SSR safety', () => {
    it('lanza si se usa fuera del RouterProvider', () => {
        function Page() {
            useGuardData()
            return null
        }
        expect(() => renderToString(createElement(Page))).toThrow(
            /useGuardData must be used within a route or layout/
        )
    })
})

describe('useGuardData — dentro del RouterContext', () => {
    let container: HTMLDivElement

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        document.body.removeChild(container)
    })

    it('devuelve el guardData del contexto', async () => {
        const session = {user: {id: '1', name: 'ana'}}
        const ctx = makeContextValue({guardData: session})
        let received: unknown

        function Page() {
            received = useGuardData()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        expect(received).toBe(session)
    })

    it('devuelve null cuando ningún guard retornó datos', async () => {
        const ctx = makeContextValue({guardData: null})
        let received: unknown = 'sentinel'

        function Page() {
            received = useGuardData()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        expect(received).toBeNull()
    })

    it('el genérico typeof guard preserva el tipo del retorno', async () => {
        // Solo verifica que compile + retorne el valor — el typing real se valida en TS check
        async function guard() {
            return {role: 'admin' as const, userId: '42'}
        }
        type Expected = Awaited<ReturnType<typeof guard>>

        const value: Expected = {role: 'admin', userId: '42'}
        const ctx = makeContextValue({guardData: value})
        let received: Expected | undefined

        function Page() {
            received = useGuardData<typeof guard>()
            return null
        }

        await act(async () => {
            createRoot(container).render(
                createElement(RouterContext.Provider, {value: ctx}, createElement(Page))
            )
        })

        expect(received).toEqual({role: 'admin', userId: '42'})
    })
})
