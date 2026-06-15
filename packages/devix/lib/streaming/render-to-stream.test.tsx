import { createResource } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { renderToStream } from './render-to-stream'

type Writable = { write: (v: string) => void; end: () => void }

function mockWritable() {
  const writes: string[] = []
  return {
    writes,
    writable: {
      write: (v: string) => writes.push(v),
      end: vi.fn(),
    } satisfies Writable,
  }
}

async function flush() {
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => setTimeout(r, 0))
  }
  await new Promise<void>((r) => setImmediate(r))
}

describe('renderToStream', () => {
  it('invokes onShellReady before onAllReady', async () => {
    const order: string[] = []
    const stream = renderToStream(() => <div />, {
      onShellReady: () => order.push('shell'),
      onAllReady: () => order.push('all'),
    })
    stream.pipe(mockWritable().writable)
    await flush()
    expect(order).toEqual(['shell', 'all'])
  })

  it('emits the rendered HTML through pipe', async () => {
    const { writes, writable } = mockWritable()
    const stream = renderToStream(() => <div>rendered-html</div>)
    stream.pipe(writable)
    await flush()
    expect(writes.join('')).toContain('rendered-html')
  })

  it('onShellReady fires before all resources resolve (streaming TTFB)', async () => {
    const order: string[] = []
    const { writes, writable } = mockWritable()
    let resolveData: ((value: string) => void) | undefined
    const dataPromise = new Promise<string>((r) => {
      resolveData = r
    })
    const stream = renderToStream(
      () => {
        const [data] = createResource(() => dataPromise)
        return (
          <div>
            <p>Static shell</p>
            <p>Data: {data() ?? 'loading'}</p>
          </div>
        )
      },
      {
        onShellReady: () => order.push('shell'),
        onAllReady: () => order.push('all'),
      },
    )
    stream.pipe(writable)

    await flush()
    expect(order).toEqual(['shell'])
    expect(writes.join('')).toContain('Static shell')
    expect(writes.join('')).toContain('loading')
    expect(resolveData).toBeDefined()

    resolveData?.('payload')
    await flush()
    expect(order).toEqual(['shell', 'all'])
    expect(writes.join('')).toContain('payload')
  })
})
