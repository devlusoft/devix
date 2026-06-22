// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {createElement, act} from 'react'
import {createRoot, Root} from 'react-dom/client'
import {RouterProvider, useRevalidate} from '@devlusoft/devix'
import {matchClientRoute, loadErrorPage, getDefaultErrorPage} from 'virtual:devix/client-routes'

let capturedRevalidate: (() => Promise<void>) | null = null
let receivedLoaderData: unknown = null

function TestPage(props: any) {
    capturedRevalidate = useRevalidate()
    receivedLoaderData = props.data
    return null
}

let container: HTMLDivElement
let root: Root | null

beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = null
    capturedRevalidate = null
    receivedLoaderData = null
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.mocked(getDefaultErrorPage).mockReturnValue(null as any)
    vi.mocked(loadErrorPage).mockResolvedValue(null)
    vi.mocked(matchClientRoute).mockReturnValue(null)
})

afterEach(() => {
    if (root) act(() => { root!.unmount() })
    if (container.parentNode) document.body.removeChild(container)
    vi.unstubAllGlobals()
})

async function renderProvider(initialData: unknown = {n: 0}) {
    await act(async () => {
        root = createRoot(container)
        root.render(createElement(RouterProvider, {
            matchClientRoute: matchClientRoute as any,
            loadErrorPage: loadErrorPage as any,
            getDefaultErrorPage: getDefaultErrorPage as any,
            initialData,
            initialParams: {},
            initialPage: TestPage,
            clientEntry: '/entry.js',
        }))
    })
}

describe('revalidate — race condition (#11)', () => {
    function mockFetch(opts: {
        htmlDelay: (revIdx: number) => number
        dataDelay: (revIdx: number) => number
        dataPayload: (revIdx: number) => unknown
    }): { fetchMock: ReturnType<typeof vi.fn>; fetchSignals: AbortSignal[] } {
        const fetchSignals: AbortSignal[] = []
        const signalsSeen = new WeakMap<AbortSignal, number>()
        let nextRevIdx = 0
        const fetchMock = vi.fn((url: string, fetchOpts?: any) => {
            const signal: AbortSignal = fetchOpts.signal
            fetchSignals.push(signal)
            const isHtml = !url.includes('/_devix/data')
            let revIdx: number
            if (signalsSeen.has(signal)) {
                revIdx = signalsSeen.get(signal)!
            } else {
                revIdx = nextRevIdx++
                signalsSeen.set(signal, revIdx)
            }
            const delay = isHtml ? opts.htmlDelay(revIdx) : opts.dataDelay(revIdx)
            const payload = isHtml
                ? `<html><body><script>window.__DEVIX_QUERIES__={};</script></body></html>`
                : JSON.stringify(opts.dataPayload(revIdx))
            const headers: Record<string, string> = isHtml
                ? {}
                : { 'Content-Type': 'application/json' }
            return new Promise<Response>((resolve, reject) => {
                const timer = setTimeout(() => {
                    resolve(new Response(payload, {status: 200, headers}))
                }, delay)
                signal.addEventListener('abort', () => {
                    clearTimeout(timer)
                    reject(new DOMException('aborted', 'AbortError'))
                })
            })
        })
        return { fetchMock, fetchSignals }
    }

    it('múltiples revalidate concurrentes: la previa se aborta cuando se dispara una nueva', async () => {
        const { fetchMock, fetchSignals } = mockFetch({
            htmlDelay: () => 100,
            dataDelay: (revIdx) => (revIdx === 0 ? 100 : 20),
            dataPayload: (revIdx) => ({
                loaderData: {n: revIdx === 0 ? 1 : 2},
                params: {},
                layouts: [],
                guardData: null,
                metadata: null,
            }),
        })
        vi.stubGlobal('fetch', fetchMock)

        await renderProvider({n: 0})

        await act(async () => {
            const p1 = capturedRevalidate!()
            await new Promise(r => setTimeout(r, 5))
            const p2 = capturedRevalidate!()
            await Promise.allSettled([p1, p2])
        })

        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(fetchSignals[0].aborted).toBe(true)
        expect(fetchSignals[1].aborted).toBe(false)
        expect(fetchSignals[2].aborted).toBe(false)
        expect(receivedLoaderData).toEqual({n: 2})
    })

    it('después de varios revalidate, el state refleja solo el último', async () => {
        const { fetchMock, fetchSignals } = mockFetch({
            htmlDelay: () => 80,
            dataDelay: (revIdx) => (revIdx === 2 ? 10 : 80),
            dataPayload: (revIdx) => ({
                loaderData: {idx: revIdx},
                params: {},
                layouts: [],
                guardData: null,
                metadata: null,
            }),
        })
        vi.stubGlobal('fetch', fetchMock)

        await renderProvider({})

        await act(async () => {
            const p1 = capturedRevalidate!()
            await new Promise(r => setTimeout(r, 2))
            const p2 = capturedRevalidate!()
            await new Promise(r => setTimeout(r, 2))
            const p3 = capturedRevalidate!()
            await Promise.allSettled([p1, p2, p3])
        })

        expect(fetchMock).toHaveBeenCalledTimes(4)
        expect(fetchSignals[0].aborted).toBe(true)
        expect(fetchSignals[1].aborted).toBe(true)
        expect(fetchSignals[2].aborted).toBe(false)
        expect(fetchSignals[3].aborted).toBe(false)
        expect(receivedLoaderData).toEqual({idx: 2})
    })
})
