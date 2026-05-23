import {ErrorBoundary, createEffect, createSignal, onCleanup, Show} from "solid-js";
import type {Component, JSX} from "solid-js";
import type {ErrorProps} from "../server/types";

export function DevixErrorBoundary(props: {
    ErrorPage?: Component<ErrorProps>
    children: JSX.Element
}) {
    return (
        <ErrorBoundary
            fallback={(err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err)
                const stack = err instanceof Error ? (err.stack || '') : ''
                console.error('[devix] ErrorBoundary caught:', msg, '\n', stack)

                const errorProps: ErrorProps = err instanceof DevixError
                    ? {statusCode: err.statusCode, message: err.message}
                    : {statusCode: 500, message: msg}

                if (
                    typeof globalThis !== 'undefined' &&
                    (globalThis as any).__DEVIX_SSR_ERRORS__
                ) {
                    (globalThis as any).__DEVIX_SSR_ERRORS__.push({
                        message: msg,
                        stack,
                    })
                }

                return (
                    <>
                        {props.ErrorPage
                            ? <props.ErrorPage {...errorProps} />
                            : <h1>{errorProps.statusCode}</h1>}
                        <DevErrorOverlay err={err}/>
                    </>
                )
            }}
        >
            {props.children}
        </ErrorBoundary>
    )
}

function DevErrorOverlay({err}: {err: unknown}) {
    const [visible, setVisible] = createSignal(true)

    createEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setVisible(false)
        }
        document.addEventListener('keydown', handler)
        onCleanup(() => document.removeEventListener('keydown', handler))
    })

    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack || '') : ''

    return (
        <Show when={visible()}>
            <div style="all:initial;position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:#1a1a1a;-webkit-font-smoothing:antialiased">
                <div style="position:absolute;inset:0;background:rgba(0,0,0,.45)" onClick={() => setVisible(false)}/>
                <div style="position:relative;width:640px;max-width:calc(100vw - 64px);max-height:calc(100vh - 64px);background:#fff;border-radius:6px;box-shadow:0 16px 48px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden">
                    <div style="padding:16px 24px 0;display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;user-select:none">
                        <div style="width:8px;height:8px;border-radius:50%;background:#dc2626;flex-shrink:0"/>
                        Client Error
                    </div>
                    <div style="padding:14px 24px 20px;overflow-y:auto;flex:1">
                        <div style="font-size:14px;font-weight:500;color:#dc2626;margin:0;padding:10px 14px;background:#fef2f2;border-radius:4px;word-break:break-word;white-space:pre-wrap;line-height:1.4">{message}</div>
                        <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:#888;margin:12px 0 4px">Stack trace</div>
                        <pre style="margin:0;font-family:ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:#333;background:#f5f5f5;padding:12px 14px;border-radius:4px;overflow-x:auto;white-space:pre;tab-size:2;max-height:260px;overflow-y:auto">{stack || '(no stack)'}</pre>
                    </div>
                    <div style="padding:10px 24px;display:flex;justify-content:flex-end;border-top:1px solid #e5e5e5">
                        <button onClick={() => setVisible(false)} style="padding:5px 16px;border-radius:4px;border:1px solid #d1d1d1;background:#fff;color:#555;cursor:pointer;font-size:12px;font-family:inherit">Dismiss</button>
                    </div>
                </div>
            </div>
        </Show>
    )
}

export interface DevixErrorOptions {
    code?: string
    data?: unknown
}

const DEVIX_ERROR_BRAND = Symbol.for('@devlusoft/devix.DevixError')

export class DevixError extends Error {
    static [Symbol.hasInstance](value: unknown): boolean {
        return value !== null && typeof value === 'object' && (value as any)[DEVIX_ERROR_BRAND] === true
    }

    statusCode: number
    code?: string
    data?: unknown
    constructor(statusCode: number, message: string, options?: DevixErrorOptions) {
        super(message)
        this.name = 'DevixError'
        this.statusCode = statusCode
        this.code = options?.code
        this.data = options?.data
        ;(this as any)[DEVIX_ERROR_BRAND] = true
    }
}
