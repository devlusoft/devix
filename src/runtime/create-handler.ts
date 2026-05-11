import type {RouteContext} from './api-context'
import type {StandardSchemaV1} from '../utils/standard-schema'

export const HANDLER_BRAND = '__devix_handler__' as const

export interface DevixHandler<TBody = undefined, TReturn = unknown> {
    readonly [HANDLER_BRAND]: true
    readonly fn: (...args: any[]) => any
    readonly schema?: StandardSchemaV1
    readonly __body: TBody
    readonly __return: TReturn
}

/**
 * Crea un handler API tipado.
 *
 * El primer argumento (si lo declaras) es el body parseado automáticamente:
 * - `application/json` → objeto JS
 * - `multipart/form-data` o `application/x-www-form-urlencoded` → FormData
 * - cualquier otro → string
 *
 * El segundo argumento es `ctx: RouteContext` con `request`, `url`, `params`,
 * y los helpers `get`/`set` para state heredado de middleware.
 *
 * ```ts
 * // sin body
 * export const GET = createHandler(async () => ({ ok: true }))
 *
 * // con body tipado
 * export const POST = createHandler(async (body: Login) => ...)
 *
 * // con body y ctx
 * export const POST = createHandler(async (body: Login, ctx) => {
 *   const user = ctx.get<User>('user')
 *   const ua = ctx.request.headers.get('User-Agent')
 * })
 *
 * // solo ctx, sin body (ej. GET que necesita query params)
 * export const GET = createHandler(async (_body, ctx) => {
 *   const filter = ctx.url.searchParams.get('filter')
 * })
 * ```
 */
type ExtractBody<TFn> =
    TFn extends () => any ? undefined :
    TFn extends (body: infer B, ...rest: any[]) => any ? B :
    undefined

type HandlerFn = ((body: any, ctx: RouteContext) => any) | (() => any)

export function createHandler<TFn extends HandlerFn>(
    fn: TFn,
): DevixHandler<ExtractBody<TFn>, Awaited<ReturnType<TFn>>>

/**
 * Overload con Standard Schema. devix valida el body automáticamente y, si
 * falla, devuelve `400` con shape `ErrorBody` y `code: 'VALIDATION_ERROR'`.
 * El body recibido por el handler está ya validado y tipado al output del schema.
 *
 * ```ts
 * import { z } from 'zod'
 *
 * const Input = z.object({ email: z.email(), password: z.string().min(8) })
 *
 * export const POST = createHandler(Input, async (body, ctx) => {
 *   // body: z.infer<typeof Input>, ya validado
 * })
 * ```
 */
export function createHandler<TSchema extends StandardSchemaV1, TReturn>(
    schema: TSchema,
    fn: (body: StandardSchemaV1.InferOutput<TSchema>, ctx: RouteContext) => TReturn | Promise<TReturn>,
): DevixHandler<StandardSchemaV1.InferInput<TSchema>, Awaited<TReturn>>

export function createHandler(
    schemaOrFn: StandardSchemaV1 | ((...args: any[]) => any),
    maybeFn?: (...args: any[]) => any,
): DevixHandler<any, any> {
    if (maybeFn) {
        return {
            [HANDLER_BRAND]: true,
            fn: maybeFn,
            schema: schemaOrFn as StandardSchemaV1,
        } as unknown as DevixHandler<any, any>
    }
    return {
        [HANDLER_BRAND]: true,
        fn: schemaOrFn as (...args: any[]) => any,
    } as unknown as DevixHandler<any, any>
}
