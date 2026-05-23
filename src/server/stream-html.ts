import {PassThrough, Transform, TransformCallback} from "node:stream"
import {renderToStream} from "solid-js/web";
import {JSX} from "solid-js";

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
    fn: () => JSX.Element,
    head: string,
    tail: string,
    options?: CreateHtmlStreamOptions,
): CreateHtmlStreamResult {
    const output = new PassThrough()
    const injector = new HtmlTailInjector(tail)

    injector.pipe(output)
    output.write(head)

    const stream = renderToStream(fn)

    stream.pipe(injector)

    if (options?.signal) {
        if (options.signal.aborted) {
            output.destroy()
            injector.destroy()
        }
        options.signal.addEventListener('abort', () => {
            output.destroy()
            injector.destroy()
        }, {once: true})
    }

    if (options?.timeoutMs) {
        setTimeout(() => {
            output.destroy(new Error(`Stream render timed out after ${options.timeoutMs}ms`))
        }, options.timeoutMs)
    }

    return {
        stream: output, abort: () => {
            output.destroy();
            injector.destroy()
        }
    }
}