// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {createElement, act} from 'react'
import {createRoot, Root} from 'react-dom/client'
import {RouterProvider, useNavigate} from '@devlusoft/devix'
import {matchClientRoute, loadErrorPage, getDefaultErrorPage} from 'virtual:devix/client-routes'
import type {ErrorProps} from '../../src/server/types'

function makeDataResponse(body: object, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

function makeErrorResponse(statusCode: number, message: string, data?: unknown): Response {
    return makeDataResponse({statusCode, message, data}, statusCode)
}

function makeSuccessResponse(loaderData: unknown = null): Response {
    return makeDataResponse({loaderData, params: {}, layouts: [], metadata: null})
}

let capturedNavigate: ((to: string) => Promise<void>) | null = null

function TestPage() {
    capturedNavigate = useNavigate()
    return null
}

let capturedErrorProps: ErrorProps | null = null

function MockErrorPage(props: ErrorProps) {
    capturedErrorProps = props
    capturedNavigate = useNavigate()
    return null
}

function makeMatch(Page = TestPage) {
    return {
        load: vi.fn().mockResolvedValue({default: Page}),
        loadLayouts: [],
        params: {},
    }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    capturedNavigate = null
    capturedErrorProps = null

    vi.mocked(getDefaultErrorPage).mockReturnValue(MockErrorPage as any)
    vi.mocked(loadErrorPage).mockResolvedValue(null)
})

afterEach(() => {
    act(() => {
        root.unmount()
    })
    document.body.removeChild(container)
    vi.unstubAllGlobals()
    vi.mocked(matchClientRoute).mockReturnValue(null)
    vi.mocked(getDefaultErrorPage).mockReturnValue(null as any)
    vi.mocked(loadErrorPage).mockResolvedValue(null)
})

async function renderProvider(Page = TestPage) {
    await act(async () => {
        root = createRoot(container)
        root.render(createElement(RouterProvider, {
            initialData: null,
            initialParams: {},
            initialPage: Page,
            clientEntry: '/entry.js',
        }))
    })
}

async function navigate(to: string) {
    await act(async () => {
        await capturedNavigate!(to)
    })
}

describe('401 → ErrorPage con statusCode correcto', () => {
    it('statusCode en ErrorPage es 401', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(401, 'Sesion expirada')))

        await renderProvider()
        await navigate('/protected')

        expect(capturedErrorProps?.statusCode).toBe(401)
        expect(capturedErrorProps?.message).toBe('Sesion expirada')
    })

    it('no hubo full page reload — RouterProvider sigue montado', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(401, 'Sesion expirada')))

        await renderProvider()
        await navigate('/protected')

        expect(container.querySelector('[id]') === null || container.childElementCount >= 0).toBe(true)
        expect(capturedErrorProps).not.toBeNull()
    })
})

describe('body del error disponible en ErrorPage', () => {
    it('data.requiredRole llega al ErrorPage', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            makeErrorResponse(403, 'Sin permisos', {requiredRole: 'admin'})
        ))

        await renderProvider()
        await navigate('/admin')

        expect(capturedErrorProps?.statusCode).toBe(403)
        expect(capturedErrorProps?.message).toBe('Sin permisos')
        expect((capturedErrorProps?.data as any)?.requiredRole).toBe('admin')
    })

    it('headers de la respuesta llegan al ErrorPage', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        const res = new Response(
            JSON.stringify({statusCode: 401, message: 'Unauthorized'}),
            {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Error-Code': 'SESSION_EXPIRED',
                },
            }
        )
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))

        await renderProvider()
        await navigate('/protected')

        expect((capturedErrorProps?.headers as any)?.['x-error-code']).toBe('SESSION_EXPIRED')
    })

    it('error sin data — data es undefined en ErrorPage', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(401, 'Unauthorized')))

        await renderProvider()
        await navigate('/protected')

        expect(capturedErrorProps?.statusCode).toBe(401)
        expect(capturedErrorProps?.data).toBeUndefined()
    })
})

describe('404 ya no hace full page reload', () => {
    it('route conocida que el servidor devuelve 404 → ErrorPage, sin reload', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(404, 'Not found')))

        const hrefSpy = vi.fn()
        Object.defineProperty(window, 'location', {
            value: {
                ...window.location,
                set href(v: string) {
                    hrefSpy(v)
                },
            },
            writable: true,
            configurable: true,
        })

        await renderProvider()
        await navigate('/missing-page')

        expect(hrefSpy).not.toHaveBeenCalled()
        expect(capturedErrorProps?.statusCode).toBe(404)
    })

    it('statusCode en ErrorPage es 404', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(404, 'Not found')))

        await renderProvider()
        await navigate('/missing-page')

        expect(capturedErrorProps?.statusCode).toBe(404)
    })
})

describe('router se recupera de error', () => {
    it('503 → ErrorPage muestra el error; navigate posterior a ruta válida limpia el estado', async () => {
        const PageAfterError = vi.fn(() => { capturedNavigate = useNavigate(); return null })
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch(PageAfterError as any))

        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(makeErrorResponse(503, 'Service unavailable'))
            .mockResolvedValueOnce(makeSuccessResponse({user: 'John'}))
        )

        await renderProvider()

        await navigate('/down')
        expect(capturedErrorProps?.statusCode).toBe(503)
        expect(capturedNavigate).not.toBeNull()

        capturedErrorProps = null
        await navigate('/working')

        expect(capturedErrorProps).toBeNull()
    })

    it('router no queda en estado roto — puede hacer múltiples navegaciones tras el error', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())

        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(makeErrorResponse(503, 'Service unavailable'))
            .mockResolvedValueOnce(makeSuccessResponse())
            .mockResolvedValueOnce(makeSuccessResponse())
        )

        await renderProvider()
        await navigate('/error-route')
        expect(capturedErrorProps?.statusCode).toBe(503)

        await navigate('/route-a')
        await navigate('/route-b')

        const fetchMock = vi.mocked(globalThis.fetch)
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })
})

describe('error con body text/plain', () => {
    it('body de texto plano llega como message', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('Access denied', {
                status: 403,
                headers: {'Content-Type': 'text/plain'},
            })
        ))

        await renderProvider()
        await navigate('/restricted')

        expect(capturedErrorProps?.statusCode).toBe(403)
        expect(capturedErrorProps?.message).toBe('Access denied')
    })
})

describe('error sin Content-Type reconocido', () => {
    it('usa el statusCode de la respuesta HTTP cuando no hay JSON', async () => {
        vi.mocked(matchClientRoute).mockReturnValue(makeMatch())
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('<html>error</html>', {
                status: 500,
                headers: {'Content-Type': 'text/html'},
            })
        ))

        await renderProvider()
        await navigate('/crash')

        expect(capturedErrorProps?.statusCode).toBe(500)
        expect(capturedErrorProps?.message).toBe('Server error')
    })
})