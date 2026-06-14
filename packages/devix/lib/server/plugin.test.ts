import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleServerFunction } from '../data'
import { devixServer } from './plugin'
import { renderSSR } from './render'

vi.mock('./render', () => ({
  renderSSR: vi.fn(),
}))

vi.mock('../data/server-fn-handler', () => ({
  handleServerFunction: vi.fn(),
}))

const renderSSRMock = vi.mocked(renderSSR)
const handleServerFunctionMock = vi.mocked(handleServerFunction)

type Middleware = (
  req: unknown,
  res: unknown,
  next: (err?: unknown) => void,
) => Promise<void> | void

function setupMiddleware() {
  const middlewares: Middleware[] = []
  const server = {
    middlewares: {
      use: (fn: Middleware) => middlewares.push(fn),
    },
    ssrLoadModule: vi.fn(),
    ssrFixStacktrace: vi.fn(),
  }

  const postConfig = (devixServer().configureServer as (s: unknown) => () => void)(server)
  postConfig()

  return { server, middleware: middlewares[0] }
}

function makeReqRes(opts: { method: string; url: string; accept?: string }) {
  const headers: Record<string, string> = {}
  if (opts.accept !== undefined) headers.accept = opts.accept

  const reqEmitter = new EventEmitter()
  const req = Object.assign(reqEmitter, {
    method: opts.method,
    url: opts.url,
    headers,
  })
  let _statusCode = 0
  const res = {
    setHeader: vi.fn(),
    get statusCode() {
      return _statusCode
    },
    set statusCode(v: number) {
      _statusCode = v
    },
    write: vi.fn(),
    end: vi.fn(),
  }
  const next = vi.fn()
  return { req, res, next }
}

describe('devixServer middleware — happy path', () => {
  beforeEach(() => {
    renderSSRMock.mockReset()
    renderSSRMock.mockResolvedValue(undefined)
  })

  it('calls renderSSR with server, url, and res', async () => {
    const { server, middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/foo',
      accept: 'text/html',
    })

    await middleware(req, res, next)

    expect(renderSSRMock).toHaveBeenCalledWith({ server, url: '/foo', res })
  })

  it('accepts */* as a valid content type for HTML rendering', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/',
      accept: '*/*',
    })

    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(renderSSRMock).toHaveBeenCalled()
  })
})

describe('devixServer middleware — early exits', () => {
  beforeEach(() => {
    renderSSRMock.mockReset()
  })

  it('passes to next() for non-GET/HEAD methods', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'POST',
      url: '/api/foo',
      accept: 'text/html',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(renderSSRMock).not.toHaveBeenCalled()
  })

  it('responds 200 with no body for HEAD requests', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'HEAD',
      url: '/',
      accept: 'text/html',
    })

    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.end).toHaveBeenCalled()
    expect(renderSSRMock).not.toHaveBeenCalled()
  })

  it('passes to next() for Vite internal paths starting with /@', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/@vite/client',
      accept: '*/*',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(renderSSRMock).not.toHaveBeenCalled()
  })

  it('passes to next() for /node_modules/ paths', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/node_modules/some-pkg/dist/x.js',
      accept: '*/*',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(renderSSRMock).not.toHaveBeenCalled()
  })

  it('passes to next() for /__ vite internal paths', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/__open-in-editor',
      accept: '*/*',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(renderSSRMock).not.toHaveBeenCalled()
  })

  it('passes to next() for non-HTML file extensions', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/assets/logo.png',
      accept: '*/*',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(renderSSRMock).not.toHaveBeenCalled()
  })

  it('passes to next() when Accept is not text/html or */*', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/api/data',
      accept: 'application/json',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(renderSSRMock).not.toHaveBeenCalled()
  })
})

describe('devixServer middleware — error path', () => {
  it('forwards renderSSR errors to next(err) after fixing the stack', async () => {
    const err = new Error('boom')
    renderSSRMock.mockReset()
    renderSSRMock.mockRejectedValue(err)

    const { server, middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'GET',
      url: '/',
      accept: 'text/html',
    })

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledWith(err)
    expect(server.ssrFixStacktrace).toHaveBeenCalledWith(err)
  })
})

describe('devixServer middleware — server functions', () => {
  beforeEach(() => {
    renderSSRMock.mockReset()
    handleServerFunctionMock.mockReset()
  })

  it('dispatches POST /_server to handleServerFunction with req, res, and server', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'POST',
      url: '/_server',
    })

    const promise = middleware(req, res, next)
    req.emit('end')
    await promise

    expect(handleServerFunctionMock).toHaveBeenCalledTimes(1)
    expect(handleServerFunctionMock).toHaveBeenCalledWith(expect.any(Request), expect.any(Function))
    expect(renderSSRMock).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('dispatches POST /_server?ignored=query to handleServerFunction (path-only match)', async () => {
    const { middleware } = setupMiddleware()
    const { req, res, next } = makeReqRes({
      method: 'POST',
      url: '/_server?some=query',
    })

    const promise = middleware(req, res, next)
    req.emit('end')
    await promise

    expect(handleServerFunctionMock).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
  })
})
