const CONTEXT_KEY = '__devix_request_context__'
const FRAME_KEY = '__devix_current_frame__'
export interface RequestFrame {
  request: Request
  responseHeaders: Headers
}

export function __setContextStore(store: { getStore(): RequestFrame | undefined }): void {
  ;(globalThis as Record<string, unknown>)[CONTEXT_KEY] = store
}

export function __setFrame(frame: RequestFrame | null): void {
  const g = globalThis as Record<string, unknown>
  if (frame) {
    g[FRAME_KEY] = frame
  } else {
    delete g[FRAME_KEY]
  }
}

export function getFrame(): RequestFrame | null {
  const g = globalThis as Record<string, unknown>

  const store = g[CONTEXT_KEY] as { getStore(): RequestFrame | undefined } | undefined
  const alsFrame = store?.getStore()
  if (alsFrame) return alsFrame

  return (g[FRAME_KEY] as RequestFrame | undefined) ?? null
}

