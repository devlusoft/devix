import {describe, it, expect, vi} from 'vitest'
import {handleApiRequest} from '../../src/server/api'
import {DevixError} from '../../src/runtime/error-boundary'
import {createHandler} from '../../src/runtime/create-handler'
import {error} from '../../src/utils/response'
import type {StandardSchemaV1} from '../../src/utils/standard-schema'
import type {ApiGlob} from '../../src/server/types'
import type {RouteHandler, MiddlewareModule} from '../../src/runtime/api-context'

const API_DIR = 'app/api'

function makeGlob(
    routes: Record<string, () => Promise<unknown>>,
    middlewares: Record<string, () => Promise<unknown>> = {},
): ApiGlob {
    return {routes, middlewares, apiDir: API_DIR}
}

function req(method: string, path: string, body?: BodyInit, headers?: HeadersInit): Request {
    return new Request(`http://localhost${path}`, {method, body, headers})
}

describe('handleApiRequest', () => {
    it('returns 404 when no route matches', async () => {
        const glob = makeGlob({
            [`${API_DIR}/users.ts`]: vi.fn().mockResolvedValue({GET: () => new Response('ok')}),
        })
        const res = await handleApiRequest('http://localhost/api/posts', req('GET', '/api/posts'), glob)
        expect(res.status).toBe(404)
    })

    it('returns 405 when method is not defined on module', async () => {
        const glob = makeGlob({
            [`${API_DIR}/users.ts`]: vi.fn().mockResolvedValue({
                GET: async () => new Response('ok'),
            }),
        })
        const res = await handleApiRequest('http://localhost/api/users', req('POST', '/api/users'), glob)
        expect(res.status).toBe(405)
    })

    it('calls GET handler and returns its Response', async () => {
        const handler: RouteHandler = async () => new Response('hello', {status: 200})
        const glob = makeGlob({
            [`${API_DIR}/hello.ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        const res = await handleApiRequest('http://localhost/api/hello', req('GET', '/api/hello'), glob)
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('hello')
    })

    it('calls POST handler and returns its Response', async () => {
        const handler: RouteHandler = async () =>
            new Response(JSON.stringify({created: true}), {status: 201})
        const glob = makeGlob({
            [`${API_DIR}/items.ts`]: vi.fn().mockResolvedValue({POST: handler}),
        })
        const res = await handleApiRequest('http://localhost/api/items', req('POST', '/api/items'), glob)
        expect(res.status).toBe(201)
        expect(await res.json()).toEqual({created: true})
    })

    it('passes ctx with params to the handler', async () => {
        let receivedId: string | undefined
        const handler: RouteHandler = async (ctx) => {
            receivedId = ctx.params.id
            return new Response('ok')
        }
        const glob = makeGlob({
            [`${API_DIR}/users/[id].ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        await handleApiRequest('http://localhost/api/users/42', req('GET', '/api/users/42'), glob)
        expect(receivedId).toBe('42')
    })

    it('expone el Request original vía ctx.request', async () => {
        let receivedRequest: Request | undefined
        const handler: RouteHandler = async (ctx) => {
            receivedRequest = ctx.request
            return new Response('ok')
        }
        const glob = makeGlob({
            [`${API_DIR}/echo.ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        const request = req('GET', '/api/echo')
        await handleApiRequest('http://localhost/api/echo', request, glob)
        expect(receivedRequest).toBe(request)
    })

    it('auto-converts plain object return to JSON response', async () => {
        const glob = makeGlob({
            [`${API_DIR}/data.ts`]: vi.fn().mockResolvedValue({
                GET: async () => ({name: 'John', age: 30}),
            }),
        })
        const res = await handleApiRequest('http://localhost/api/data', req('GET', '/api/data'), glob)
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('application/json')
        expect(await res.json()).toEqual({name: 'John', age: 30})
    })

    it('auto-converts array return to JSON response', async () => {
        const glob = makeGlob({
            [`${API_DIR}/list.ts`]: vi.fn().mockResolvedValue({
                GET: async () => [{id: 1}, {id: 2}],
            }),
        })
        const res = await handleApiRequest('http://localhost/api/list', req('GET', '/api/list'), glob)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([{id: 1}, {id: 2}])
    })

    it('returns 204 when handler returns null', async () => {
        const glob = makeGlob({
            [`${API_DIR}/empty.ts`]: vi.fn().mockResolvedValue({
                DELETE: async () => null,
            }),
        })
        const res = await handleApiRequest('http://localhost/api/empty', req('DELETE', '/api/empty'), glob)
        expect(res.status).toBe(204)
    })


    it('runs middleware before the handler', async () => {
        const order: string[] = []

        const middleware: MiddlewareModule['middleware'] = async () => {
            order.push('middleware')
            return null
        }
        const handler: RouteHandler = async () => {
            order.push('handler')
            return new Response('ok')
        }

        const glob = makeGlob(
            {[`${API_DIR}/ping.ts`]: vi.fn().mockResolvedValue({GET: handler})},
            {[`${API_DIR}/middleware.ts`]: vi.fn().mockResolvedValue({middleware})},
        )
        await handleApiRequest('http://localhost/api/ping', req('GET', '/api/ping'), glob)
        expect(order).toEqual(['middleware', 'handler'])
    })

    it('middleware can short-circuit and block the handler', async () => {
        const handlerSpy = vi.fn().mockResolvedValue(new Response('should not reach'))
        const middleware: MiddlewareModule['middleware'] = async () =>
            new Response('blocked', {status: 401})

        const glob = makeGlob(
            {[`${API_DIR}/secret.ts`]: vi.fn().mockResolvedValue({GET: handlerSpy})},
            {[`${API_DIR}/middleware.ts`]: vi.fn().mockResolvedValue({middleware})},
        )
        const res = await handleApiRequest('http://localhost/api/secret', req('GET', '/api/secret'), glob)
        expect(res.status).toBe(401)
        expect(handlerSpy).not.toHaveBeenCalled()
    })

    it('returns 500 on unexpected handler error', async () => {
        const glob = makeGlob({
            [`${API_DIR}/boom.ts`]: vi.fn().mockResolvedValue({
                GET: async () => { throw new Error('unexpected') },
            }),
        })
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const res = await handleApiRequest('http://localhost/api/boom', req('GET', '/api/boom'), glob)
        expect(res.status).toBe(500)
    })

    it('returns DevixError status when handler throws DevixError', async () => {
        const glob = makeGlob({
            [`${API_DIR}/guarded.ts`]: vi.fn().mockResolvedValue({
                GET: async () => { throw new DevixError(403, 'Forbidden') },
            }),
        })
        const res = await handleApiRequest('http://localhost/api/guarded', req('GET', '/api/guarded'), glob)
        expect(res.status).toBe(403)
        expect(res.headers.get('Content-Type')).toBe('application/json')
        expect(await res.json()).toEqual({statusCode: 403, message: 'Forbidden'})
    })

    it('DevixError cross-bundle: instanceof reconoce por brand', () => {
        const BRAND = Symbol.for('@devlusoft/devix.DevixError')
        const fakeError = Object.assign(new Error('cross-bundle'), {
            statusCode: 500,
            [BRAND]: true,
        })
        expect(fakeError instanceof DevixError).toBe(true)

        const plainError = new Error('not a DevixError')
        expect(plainError instanceof DevixError).toBe(false)

        const realError = new DevixError(403, 'Forbidden')
        expect(realError instanceof DevixError).toBe(true)
        expect(realError instanceof Error).toBe(true)
    })

    it('DevixError con code y data se serializa al shape estandarizado', async () => {
        const glob = makeGlob({
            [`${API_DIR}/guarded.ts`]: vi.fn().mockResolvedValue({
                GET: async () => { throw new DevixError(403, 'Forbidden', {code: 'NOT_ADMIN', data: {role: 'user'}}) },
            }),
        })
        const res = await handleApiRequest('http://localhost/api/guarded', req('GET', '/api/guarded'), glob)
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({
            statusCode: 403,
            message: 'Forbidden',
            code: 'NOT_ADMIN',
            data: {role: 'user'},
        })
    })

    it('handler que retorna error() responde con el shape ErrorBody', async () => {
        const glob = makeGlob({
            [`${API_DIR}/posts.ts`]: vi.fn().mockResolvedValue({
                GET: async () => error(404, 'Post no encontrado', {code: 'POST_NOT_FOUND'}),
            }),
        })
        const res = await handleApiRequest('http://localhost/api/posts', req('GET', '/api/posts'), glob)
        expect(res.status).toBe(404)
        expect(res.headers.get('Content-Type')).toBe('application/json')
        expect(await res.json()).toEqual({
            statusCode: 404,
            message: 'Post no encontrado',
            code: 'POST_NOT_FOUND',
        })
    })

    it('createHandler que retorna error() también funciona', async () => {
        const glob = makeGlob({
            [`${API_DIR}/posts.ts`]: vi.fn().mockResolvedValue({
                POST: createHandler(async (_body: {title: string}) => error(422, 'Validation', {code: 'INVALID_TITLE'})),
            }),
        })
        const res = await handleApiRequest('http://localhost/api/posts', req('POST', '/api/posts', JSON.stringify({title: ''}), {'Content-Type': 'application/json'}), glob)
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
            statusCode: 422,
            message: 'Validation',
            code: 'INVALID_TITLE',
        })
    })

    it('error de servidor genérico devuelve shape ErrorBody', async () => {
        const glob = makeGlob({
            [`${API_DIR}/boom.ts`]: vi.fn().mockResolvedValue({
                GET: async () => { throw new Error('oops') },
            }),
        })
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const res = await handleApiRequest('http://localhost/api/boom', req('GET', '/api/boom'), glob)
        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({statusCode: 500, message: 'Internal Server Error'})
    })

    it('URL-decodes params', async () => {
        let receivedSlug: string | undefined
        const handler: RouteHandler = async (ctx) => {
            receivedSlug = ctx.params.slug
            return new Response('ok')
        }
        const glob = makeGlob({
            [`${API_DIR}/posts/[slug].ts`]: vi.fn().mockResolvedValue({GET: handler}),
        })
        await handleApiRequest(
            'http://localhost/api/posts/hello%20world',
            req('GET', '/api/posts/hello%20world'),
            glob,
        )
        expect(receivedSlug).toBe('hello world')
    })

    describe('createHandler signature con ctx', () => {
        it('createHandler con (body, ctx) recibe ambos', async () => {
            let receivedBody: any
            let receivedCtx: any
            const glob = makeGlob({
                [`${API_DIR}/echo.ts`]: vi.fn().mockResolvedValue({
                    POST: createHandler(async (body: {x: number}, ctx) => {
                        receivedBody = body
                        receivedCtx = ctx
                        return {ok: true}
                    }),
                }),
            })
            await handleApiRequest(
                'http://localhost/api/echo',
                req('POST', '/api/echo', JSON.stringify({x: 1}), {'Content-Type': 'application/json'}),
                glob,
            )
            expect(receivedBody).toEqual({x: 1})
            expect(receivedCtx).toBeDefined()
            expect(receivedCtx.request).toBeInstanceOf(Request)
            expect(receivedCtx.url).toBeInstanceOf(URL)
        })

        it('ctx.url expone query params parseados', async () => {
            let filterValue: string | null = null
            const glob = makeGlob({
                [`${API_DIR}/search.ts`]: vi.fn().mockResolvedValue({
                    GET: createHandler(async (_body, ctx) => {
                        filterValue = ctx.url.searchParams.get('filter')
                        return {results: []}
                    }),
                }),
            })
            await handleApiRequest(
                'http://localhost/api/search?filter=active',
                req('GET', '/api/search?filter=active'),
                glob,
            )
            expect(filterValue).toBe('active')
        })

        it('ctx.params funciona en createHandler', async () => {
            let id: string | undefined
            const glob = makeGlob({
                [`${API_DIR}/users/[id].ts`]: vi.fn().mockResolvedValue({
                    GET: createHandler(async (_body, ctx) => {
                        id = ctx.params.id
                        return {ok: true}
                    }),
                }),
            })
            await handleApiRequest(
                'http://localhost/api/users/42',
                req('GET', '/api/users/42'),
                glob,
            )
            expect(id).toBe('42')
        })

        it('ctx.get expone state heredado de middleware', async () => {
            let receivedUser: string | undefined
            const middleware: MiddlewareModule['middleware'] = async (ctx) => {
                ctx.set('user', 'alice')
                return null
            }
            const glob = makeGlob(
                {
                    [`${API_DIR}/me.ts`]: vi.fn().mockResolvedValue({
                        GET: createHandler(async (_body, ctx) => {
                            receivedUser = ctx.get<string>('user')
                            return {ok: true}
                        }),
                    }),
                },
                {[`${API_DIR}/middleware.ts`]: vi.fn().mockResolvedValue({middleware})},
            )
            await handleApiRequest('http://localhost/api/me', req('GET', '/api/me'), glob)
            expect(receivedUser).toBe('alice')
        })

        it('handler sin args (length 0) no parsea body', async () => {
            const glob = makeGlob({
                [`${API_DIR}/ping.ts`]: vi.fn().mockResolvedValue({
                    GET: createHandler(async () => ({pong: true})),
                }),
            })
            const res = await handleApiRequest('http://localhost/api/ping', req('GET', '/api/ping'), glob)
            expect(await res.json()).toEqual({pong: true})
        })
    })

    describe('createHandler con Standard Schema', () => {
        const LoginSchema: StandardSchemaV1<{email: string; password: string}> = {
            '~standard': {
                version: 1,
                vendor: 'test',
                validate: (input: unknown) => {
                    if (typeof input !== 'object' || input === null) {
                        return {issues: [{message: 'must be an object'}]}
                    }
                    const o = input as Record<string, unknown>
                    const issues: {message: string; path: (string | number)[]}[] = []
                    if (typeof o.email !== 'string' || !o.email.includes('@')) {
                        issues.push({message: 'invalid email', path: ['email']})
                    }
                    if (typeof o.password !== 'string' || o.password.length < 8) {
                        issues.push({message: 'password too short', path: ['password']})
                    }
                    if (issues.length > 0) return {issues}
                    return {value: {email: o.email as string, password: o.password as string}}
                },
            },
        }

        it('body válido se pasa al handler ya validado y tipado', async () => {
            let receivedBody: any
            const glob = makeGlob({
                [`${API_DIR}/login.ts`]: vi.fn().mockResolvedValue({
                    POST: createHandler(LoginSchema, async (body) => {
                        receivedBody = body
                        return {ok: true}
                    }),
                }),
            })
            const res = await handleApiRequest(
                'http://localhost/api/login',
                req('POST', '/api/login', JSON.stringify({email: 'a@b.com', password: 'secret123'}), {'Content-Type': 'application/json'}),
                glob,
            )
            expect(res.status).toBe(200)
            expect(receivedBody).toEqual({email: 'a@b.com', password: 'secret123'})
        })

        it('body inválido devuelve 400 con shape ErrorBody y code VALIDATION_ERROR', async () => {
            const handlerSpy = vi.fn()
            const glob = makeGlob({
                [`${API_DIR}/login.ts`]: vi.fn().mockResolvedValue({
                    POST: createHandler(LoginSchema, async (body) => {
                        handlerSpy(body)
                        return {ok: true}
                    }),
                }),
            })
            const res = await handleApiRequest(
                'http://localhost/api/login',
                req('POST', '/api/login', JSON.stringify({email: 'bad', password: 'x'}), {'Content-Type': 'application/json'}),
                glob,
            )
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.statusCode).toBe(400)
            expect(body.message).toBe('Validation failed')
            expect(body.code).toBe('VALIDATION_ERROR')
            expect(body.data.issues).toEqual([
                {message: 'invalid email', path: ['email']},
                {message: 'password too short', path: ['password']},
            ])
            expect(handlerSpy).not.toHaveBeenCalled()
        })

        it('schema async (validate retorna Promise) también funciona', async () => {
            const AsyncSchema: StandardSchemaV1<{n: number}> = {
                '~standard': {
                    version: 1,
                    vendor: 'test',
                    validate: async (input: unknown) => {
                        await Promise.resolve()
                        if (typeof input === 'object' && input !== null && typeof (input as any).n === 'number') {
                            return {value: input as {n: number}}
                        }
                        return {issues: [{message: 'n required'}]}
                    },
                },
            }
            let received: any
            const glob = makeGlob({
                [`${API_DIR}/echo.ts`]: vi.fn().mockResolvedValue({
                    POST: createHandler(AsyncSchema, async (body) => {
                        received = body
                        return {ok: true}
                    }),
                }),
            })
            await handleApiRequest(
                'http://localhost/api/echo',
                req('POST', '/api/echo', JSON.stringify({n: 5}), {'Content-Type': 'application/json'}),
                glob,
            )
            expect(received).toEqual({n: 5})
        })

        it('schema transforma input → output y el handler recibe el output', async () => {
            const TransformSchema: StandardSchemaV1<{raw: string}, {parsed: number}> = {
                '~standard': {
                    version: 1,
                    vendor: 'test',
                    validate: (input: unknown) => {
                        const raw = (input as any)?.raw
                        const n = Number(raw)
                        if (Number.isFinite(n)) return {value: {parsed: n}}
                        return {issues: [{message: 'not a number', path: ['raw']}]}
                    },
                },
            }
            let received: any
            const glob = makeGlob({
                [`${API_DIR}/num.ts`]: vi.fn().mockResolvedValue({
                    POST: createHandler(TransformSchema, async (body) => {
                        received = body
                        return {ok: true}
                    }),
                }),
            })
            await handleApiRequest(
                'http://localhost/api/num',
                req('POST', '/api/num', JSON.stringify({raw: '42'}), {'Content-Type': 'application/json'}),
                glob,
            )
            expect(received).toEqual({parsed: 42})
        })
    })
})
