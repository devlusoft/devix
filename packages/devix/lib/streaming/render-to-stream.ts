import { renderToStream as solidRenderToStream } from 'solid-js/web'

export type RenderToStreamOptions = {
  onShellReady?: () => void
  onAllReady?: () => void
  onError?: (err: unknown) => void
  nonce?: string
  renderId?: string
}

export type StreamRender = {
  pipe: (writable: { write: (v: string) => void; end?: () => void }) => void
  pipeTo: (writable: WritableStream) => Promise<void>
}

export function renderToStream<T>(fn: () => T, options: RenderToStreamOptions = {}): StreamRender {
  const { onShellReady, onAllReady, onError, ...rest } = options

  const solidOptions = {
    ...rest,
    onCompleteShell: onShellReady ? () => onShellReady() : undefined,
    onCompleteAll: onAllReady ? () => onAllReady() : undefined,
    onError,
  } as Parameters<typeof solidRenderToStream>[1]

  return (solidRenderToStream as (fn: () => T, options: typeof solidOptions) => StreamRender)(
    fn,
    solidOptions,
  )
}
