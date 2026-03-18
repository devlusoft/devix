import {describe, it, expect} from 'vitest'
import {withHandlerStore, useRequest, useCtx, useParams} from '../../src/server/handler-store'
import {RouteContext} from '../../src/runtime/api-context'

function makeStore(params: Record<string, string> = {}) {
    const ctx = new RouteContext(params)
    const request = new Request('http://localhost/api/test')
    return {ctx, request}
}

describe('useRequest', () => {
    it('devuelve el request dentro del store', () => {
        const store = makeStore()
        withHandlerStore(store, () => {
            expect(useRequest()).toBe(store.request)
        })
    })

    it('lanza si se llama fuera del store', () => {
        expect(() => useRequest()).toThrow('[devix] useRequest() called outside of a request handler')
    })
})

describe('useCtx', () => {
    it('devuelve el ctx dentro del store', () => {
        const store = makeStore()
        withHandlerStore(store, () => {
            expect(useCtx()).toBe(store.ctx)
        })
    })

    it('lanza si se llama fuera del store', () => {
        expect(() => useCtx()).toThrow('[devix] useCtx() called outside of a request handler')
    })
})

describe('useParams', () => {
    it('devuelve los params del ctx', () => {
        const store = makeStore({id: '42', slug: 'hello'})
        withHandlerStore(store, () => {
            expect(useParams()).toEqual({id: '42', slug: 'hello'})
        })
    })

    it('lanza si se llama fuera del store', () => {
        expect(() => useParams()).toThrow('[devix] useParams() called outside of a request handler')
    })
})

describe('withHandlerStore async', () => {
    it('mantiene el contexto en callbacks async', async () => {
        const store = makeStore({id: '99'})
        await withHandlerStore(store, async () => {
            await Promise.resolve()
            expect(useParams()).toEqual({id: '99'})
        })
    })

    it('aísla contextos concurrentes', async () => {
        const store1 = makeStore({user: 'alice'})
        const store2 = makeStore({user: 'bob'})

        const p1 = withHandlerStore(store1, async () => {
            await new Promise(r => setTimeout(r, 10))
            return useParams().user
        })
        const p2 = withHandlerStore(store2, async () => {
            await new Promise(r => setTimeout(r, 5))
            return useParams().user
        })

        const [r1, r2] = await Promise.all([p1, p2])
        expect(r1).toBe('alice')
        expect(r2).toBe('bob')
    })
})
