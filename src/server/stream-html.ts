import {PassThrough, Transform, TransformCallback} from "node:stream"
import type {ReactElement} from "react";
import {renderToPipeableStream} from "react-dom/server";

class HtmlTailInjector extends Transform {
    private readonly tail: Buffer

    constructor(tail: string) {
        super()
        this.tail = Buffer.from(tail, 'utf-8')
    }

    _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback) {
        this.push(chunk)
        callback()
    }

    _flush(callback: TransformCallback) {
        this.push(this.tail)
        callback()
    }
}

export interface CreateHtmlStreamOptions {
    bootstrapModules?: string[]
    onError?: (error: unknown) => void
    signal?: AbortSignal
    timeoutMs?: number
}

export interface CreateHtmlStreamResult {
    stream: PassThrough
    abort: () => void
}

export function createHtmlStream(
    element: ReactElement,
    head: string,
    tail: string,
    options?: CreateHtmlStreamOptions,
): Promise<CreateHtmlStreamResult> {
    return new Promise((resolve, reject) => {
        const output = new PassThrough()
        const injector = new HtmlTailInjector(tail)
        let timer: ReturnType<typeof setTimeout> | undefined

        injector.pipe(output)

        const {pipe, abort} = renderToPipeableStream(element, {
            bootstrapModules: options?.bootstrapModules,
            onShellReady() {
                output.write(head)
                pipe(injector)
                clearTimeout(timer)
                resolve({stream: output, abort})
            },
            onShellError(err) {
                clearTimeout(timer)
                output.destroy()
                injector.destroy()
                reject(err)
            },
            onError(error) {
                options?.onError?.(error)
            }
        })

        if (options?.signal) {
            if (options.signal.aborted) {
                abort()
                reject(new DOMException('Aborted', 'AbortError'))
                return
            }
            options.signal.addEventListener('abort', () => abort(), {once: true})
        }

        if (options?.timeoutMs) {
            timer = setTimeout(() => {
                abort()
                reject(new Error(`Stream render timed out after ${options.timeoutMs}ms`))
            }, options.timeoutMs)
        }
    })
}