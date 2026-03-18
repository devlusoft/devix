import {describe, it, expect} from 'vitest'
import {createHandler, HANDLER_BRAND} from '../../src/runtime/create-handler'
import {json} from '../../src/utils/response'

describe('createHandler', () => {
    it('devuelve un objeto con la marca HANDLER_BRAND', () => {
        const h = createHandler(async () => null)
        expect(h[HANDLER_BRAND]).toBe(true)
    })

    it('sin args — fn.length es 0', () => {
        const h = createHandler(async () => null)
        expect(h.fn.length).toBe(0)
    })

    it('con body — fn.length es 1', () => {
        const h = createHandler<{email: string}>(async (_body:any) => null)
        expect(h.fn.length).toBe(1)
    })

    it('ejecuta el handler sin body', async () => {
        const h = createHandler(async () => json({ok: true}))
        const result = await h.fn()
        expect(result).toBeInstanceOf(Response)
    })

    it('ejecuta el handler con body', async () => {
        const h = createHandler<{name: string}>(async (body:any) => json({hello: body.name}))
        const result = await h.fn({name: 'devix'})
        expect(await (result as Response).json()).toEqual({hello: 'devix'})
    })

    it('preserva el tipo de retorno via __return (type-only)', () => {
        const h = createHandler(async () => json({id: 1}))
        expect('__return' in h).toBe(false)
        expect('__body' in h).toBe(false)
    })
})
