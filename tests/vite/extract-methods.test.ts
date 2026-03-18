import {describe, it, expect} from 'vitest'
import {extractHttpMethods} from '../../src/vite/codegen/extract-methods'

describe('extractHttpMethods', () => {
    it('detecta export const GET', () => {
        expect(extractHttpMethods(`export const GET: RouteHandler = async () => {}`)).toContain('GET')
    })

    it('detecta export async function POST', () => {
        expect(extractHttpMethods(`export async function POST(ctx, req) {}`)).toContain('POST')
    })

    it('detecta export function DELETE', () => {
        expect(extractHttpMethods(`export function DELETE(ctx, req) {}`)).toContain('DELETE')
    })

    it('detecta múltiples métodos en el mismo archivo', () => {
        const content = `
export const GET: RouteHandler = async () => ({ ok: true })
export const POST: RouteHandler = async () => ({ ok: true })
export const DELETE: RouteHandler = async () => null
`
        const methods = extractHttpMethods(content)
        expect(methods).toContain('GET')
        expect(methods).toContain('POST')
        expect(methods).toContain('DELETE')
        expect(methods).toHaveLength(3)
    })

    it('no detecta nombres parciales (GETTER no es GET)', () => {
        expect(extractHttpMethods(`export const GETTER = () => {}`)).not.toContain('GET')
    })

    it('no detecta métodos en comentarios', () => {
        const content = `
// export const GET: RouteHandler = async () => {}
/* export const POST = () => {} */
`
        expect(extractHttpMethods(content)).toHaveLength(0)
    })

    it('retorna array vacío si no hay exports HTTP', () => {
        expect(extractHttpMethods(`export const helper = () => {}`)).toHaveLength(0)
    })

    it('no duplica métodos si aparecen varias veces', () => {
        const content = `
export const GET: RouteHandler = async () => {}
// export const GET — otro comentario
export const GET = async () => {}
`
        const methods = extractHttpMethods(content)
        expect(methods.filter(m => m === 'GET')).toHaveLength(1)
    })

    it('detecta todos los métodos HTTP estándar', () => {
        const content = `
export const GET = async () => {}
export const POST = async () => {}
export const PUT = async () => {}
export const PATCH = async () => {}
export const DELETE = async () => {}
export const HEAD = async () => {}
export const OPTIONS = async () => {}
`
        expect(extractHttpMethods(content)).toHaveLength(7)
    })
})
