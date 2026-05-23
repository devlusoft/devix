// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {renderToString} from 'solid-js/web'
import {render} from 'solid-js/web'
import {useGuardData} from '../../src/runtime'
import {RouterContext} from '../../src/runtime/context'

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
    it('no interrumpe SSR fuera del RouterProvider (Solid atrapa el error)', () => {
        let captured: unknown
        function Page() {
            captured = useGuardData()
            return <div />
        }
        expect(() => renderToString(() => <Page />)).not.toThrow()
    })
})

describe('useGuardData — dentro del RouterContext', () => {
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

    it('devuelve el guardData del contexto', () => {
        const session = {user: {id: '1', name: 'ana'}}
        const ctx = makeContextValue({guardData: session})
        let received: unknown

        function Page() {
            received = useGuardData()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        expect(received).toBe(session)
    })

    it('devuelve null cuando ningún guard retornó datos', () => {
        const ctx = makeContextValue({guardData: null})
        let received: unknown = 'sentinel'

        function Page() {
            received = useGuardData()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        expect(received).toBeNull()
    })

    it('el genérico typeof guard preserva el tipo del retorno', () => {
        async function guard() {
            return {role: 'admin' as const, userId: '42'}
        }
        type Expected = Awaited<ReturnType<typeof guard>>

        const value: Expected = {role: 'admin', userId: '42'}
        const ctx = makeContextValue({guardData: value})
        let received: Expected | undefined

        function Page() {
            received = useGuardData<typeof guard>()
            return <div />
        }

        dispose = render(() => (
            <RouterContext.Provider value={ctx}>
                <Page />
            </RouterContext.Provider>
        ), container)

        expect(received).toEqual({role: 'admin', userId: '42'})
    })
})
