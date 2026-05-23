// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {render} from 'solid-js/web'
import {RouterProvider, useRevalidate} from '@devlusoft/devix'
import {matchClientRoute, loadErrorPage, getDefaultErrorPage} from 'virtual:devix/client-routes'

let capturedRevalidate: (() => Promise<void>) | null = null
let receivedLoaderData: unknown = null

function TestPage(props: any) {
    capturedRevalidate = useRevalidate()
    receivedLoaderData = props.data
    return <div />
}

let container: HTMLDivElement
let dispose: () => void

beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    dispose = () => {}
    capturedRevalidate = null
    receivedLoaderData = null
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.mocked(getDefaultErrorPage).mockReturnValue(null as any)
    vi.mocked(loadErrorPage).mockResolvedValue(null)
    vi.mocked(matchClientRoute).mockReturnValue(null)
})

afterEach(() => {
    dispose?.()
    if (container.parentNode) document.body.removeChild(container)
    vi.unstubAllGlobals()
})

function renderProvider(initialData: unknown = {n: 0}) {
    dispose = render(() => (
        <RouterProvider
            matchClientRoute={matchClientRoute as any}
            loadErrorPage={loadErrorPage as any}
            getDefaultErrorPage={getDefaultErrorPage as any}
            initialData={initialData}
            initialParams={{}}
            initialPage={TestPage as any}
            clientEntry='/entry.js'
        />
    ), container)
}

describe('revalidate — race condition (#11)', () => {
    it('múltiples revalidate concurrentes: la previa se aborta cuando se dispara una nueva', async () => {
        const fetchCallSignals: AbortSignal[] = []
        let callIdx = 0
        const fetchMock = vi.fn((_url: string, opts?: any) => {
            const signal: AbortSignal = opts.signal
            const isFirst = callIdx === 0
            callIdx += 1
            fetchCallSignals.push(signal)

            return new Promise<Response>((resolve, reject) => {
                const delay = isFirst ? 100 : 20
                const timer = setTimeout(() => {
                    resolve(new Response(JSON.stringify({
                        loaderData: {n: isFirst ? 1 : 2},
                        params: {},
                        layouts: [],
                        guardData: null,
                        metadata: null,
                    }), {status: 200, headers: {'Content-Type': 'application/json'}}))
                }, delay)
                signal.addEventListener('abort', () => {
                    clearTimeout(timer)
                    reject(new DOMException('aborted', 'AbortError'))
                })
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        renderProvider({n: 0})

        const p1 = capturedRevalidate!()
        await new Promise(r => setTimeout(r, 5))
        const p2 = capturedRevalidate!()
        await Promise.allSettled([p1, p2])

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchCallSignals[0].aborted).toBe(true)   // p1 fue abortado por p2
        expect(fetchCallSignals[1].aborted).toBe(false)  // p2 terminó normal
        expect(receivedLoaderData).toEqual({n: 2})
    })

    it('después de varios revalidate, el state refleja solo el último', async () => {
        let callIdx = 0
        const fetchMock = vi.fn((_url: string, opts?: any) => {
            const signal: AbortSignal = opts.signal
            const idx = callIdx
            callIdx += 1
            return new Promise<Response>((resolve, reject) => {
                const delay = idx === 2 ? 10 : 80
                const timer = setTimeout(() => {
                    resolve(new Response(JSON.stringify({
                        loaderData: {idx},
                        params: {},
                        layouts: [],
                        guardData: null,
                        metadata: null,
                    }), {status: 200, headers: {'Content-Type': 'application/json'}}))
                }, delay)
                signal.addEventListener('abort', () => {
                    clearTimeout(timer)
                    reject(new DOMException('aborted', 'AbortError'))
                })
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        renderProvider({})

        const p1 = capturedRevalidate!()
        await new Promise(r => setTimeout(r, 2))
        const p2 = capturedRevalidate!()
        await new Promise(r => setTimeout(r, 2))
        const p3 = capturedRevalidate!()
        await Promise.allSettled([p1, p2, p3])

        expect(receivedLoaderData).toEqual({idx: 2})
    })
})
