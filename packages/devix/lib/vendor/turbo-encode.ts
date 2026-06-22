// @ts-nocheck
// Vendored from turbo-stream v3.2.0 (MIT)
// Fix: move wg.done() after encode2() in Promise handlers to prevent
// race condition where controller.close() runs before pending encoding flushes

const STR_ARRAY_BUFFER = "A"
const STR_ASYNC_ITERABLE = "*"
const STR_BLOB = "K"
const STR_BIGINT = "b"
const STR_BIG_INT_64_ARRAY = "J"
const STR_BIG_UINT_64_ARRAY = "j"
const STR_DATA_VIEW = "V"
const STR_DATE = "D"
const STR_ERROR = "E"
const STR_FAILURE = "!"
const STR_FALSE = "false"
const STR_FILE = "k"
const STR_FLOAT_32_ARRAY = "H"
const STR_FLOAT_64_ARRAY = "h"
const STR_FORM_DATA = "F"
const STR_INFINITY = "I"
const STR_INT_8_ARRAY = "O"
const STR_INT_16_ARRAY = "L"
const STR_INT_32_ARRAY = "G"
const STR_MAP = "M"
const STR_NaN = "NaN"
const STR_NEGATIVE_INFINITY = "i"
const STR_NEGATIVE_ZERO = "z"
const STR_NULL = "null"
const STR_PLUGIN = "P"
const STR_PROMISE = "$"
const STR_READABLE_STREAM = "R"
const STR_REDACTED = "<redacted>"
const STR_REFERENCE_SYMBOL = "@"
const STR_REGEXP = "r"
const STR_SET = "S"
const STR_SUCCESS = ":"
const STR_SYMBOL = "s"
const STR_TRUE = "true"
const STR_UINT_8_ARRAY = "o"
const STR_UINT_8_ARRAY_CLAMPED = "C"
const STR_UINT_16_ARRAY = "l"
const STR_UINT_32_ARRAY = "g"
const STR_UNDEFINED = "u"
const STR_URL = "U"

class WaitGroup {
    p = 0
    _q: (() => void)[] = []

    _waitQueue(resolve: () => void) {
        if (this.p === 0) {
            resolve()
        } else {
            this._q.push(resolve)
        }
    }

    add() {
        this.p++
    }

    done() {
        if (--this.p === 0) {
            let r: (() => void) | undefined
            while ((r = this._q.shift()) !== undefined) {
                r()
            }
        }
    }

    wait(): Promise<void> {
        return new Promise(this._waitQueue.bind(this))
    }
}

class ChunkBuffer {
    controller: ReadableStreamDefaultController<string>
    chunks: string[] = []
    size = 0
    highWaterMark: number

    constructor(controller: ReadableStreamDefaultController<string>, highWaterMark: number) {
        this.controller = controller
        this.highWaterMark = highWaterMark
    }

    push(...chunks: unknown[]) {
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            if (chunk == null) continue
            const stringified = typeof chunk === "string" ? chunk : String(chunk)
            this.chunks.push(stringified)
            this.size += stringified.length
            if (this.size >= this.highWaterMark) {
                this.flush()
            }
        }
    }

    flush(suffix = "") {
        if (this.chunks.length > 0 || suffix.length > 0) {
            this.controller.enqueue(this.chunks.join("") + suffix)
            this.chunks.length = 0
            this.size = 0
        }
    }
}

const { NEGATIVE_INFINITY, POSITIVE_INFINITY } = Number
const { isNaN: nan } = Number

const ASYNC_FRAME_TYPE_PROMISE = 1
const ASYNC_FRAME_TYPE_ITERABLE = 2

export function encode(
    value: unknown,
    {
        plugins = [],
        redactErrors = true,
        signal,
        highWaterMark = 16 * 1024,
    }: {
        plugins?: ((value: unknown) => unknown[] | undefined)[]
        redactErrors?: boolean | string
        signal?: AbortSignal
        highWaterMark?: number
    } = {},
): ReadableStream<string> {
    const aborted = () => signal?.aborted ?? false
    const waitForAbort = new Promise<never>((_, reject) => {
        signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"))
        })
    })

    return new ReadableStream({
        async start(controller) {
            const refCache = new WeakMap<object, number>()
            const asyncCache = new WeakMap<object, number>()
            const counters = { refId: 0, promiseId: 0 }
            const wg = new WaitGroup()
            const chunks = new ChunkBuffer(controller, highWaterMark)

            const doEncode = (val: unknown) => {
                encodeSync(val, chunks, refCache, asyncCache, promises, counters, plugins, redactErrors)
                chunks.flush("\n")
            }

            // FIX: wg.done() moved AFTER chunks.push/encode2 to prevent race condition
            // where controller.close() runs before pending encoding flushes
            const handlePromiseResolved = (id: number, val: unknown) => {
                if (aborted()) return
                chunks.push(`${id}${STR_SUCCESS}`)
                doEncode(val)
                wg.done()
            }

            const handlePromiseRejected = (id: number, error: unknown) => {
                if (aborted()) return
                chunks.push(`${id}${STR_FAILURE}`)
                doEncode(error)
                wg.done()
            }

            const promises = {
                get: asyncCache.get.bind(asyncCache) as (key: object) => number | undefined,
                set: asyncCache.set.bind(asyncCache) as (key: object, value: number) => void,
                push: (...promiseFrames: [number, number, unknown][]) => {
                    for (const [type, id, promise] of promiseFrames) {
                        wg.add()
                        if (type === ASYNC_FRAME_TYPE_PROMISE) {
                            Promise.race([promise as Promise<unknown>, waitForAbort]).then(
                                (v) => handlePromiseResolved(id, v),
                                (e) => handlePromiseRejected(id, e),
                            )
                        } else {
                            ;(async () => {
                                const iterator = (promise as AsyncIterable<unknown>)[Symbol.asyncIterator]()
                                let result: IteratorResult<unknown>
                                do {
                                    result = await iterator.next()
                                    if (aborted()) return
                                    if (!result.done) {
                                        chunks.push(`${id}${STR_SUCCESS}`)
                                        doEncode(result.value)
                                    }
                                } while (!result.done)
                            })().then(
                                () => {
                                    if (aborted()) return
                                    chunks.push(`${id}\n`)
                                    chunks.flush()
                                },
                                (error: unknown) => {
                                    if (aborted()) return
                                    chunks.push(`${id}${STR_FAILURE}`)
                                    doEncode(error)
                                },
                            ).finally(() => {
                                wg.done()
                            })
                        }
                    }
                },
            }

            try {
                doEncode(value)
                do {
                    await Promise.race([wg.wait(), waitForAbort])
                } while (wg.p > 0)
                controller.close()
            } catch (error) {
                controller.error(error)
            }
        },
    })
}

export function encodeSync(
    value: unknown,
    chunks: ChunkBuffer,
    refs: WeakMap<object, number>,
    promises: { get(key: object): number | undefined; set(key: object, value: number): void },
    asyncFrames: { push(...frames: [number, number, unknown][]): void },
    counters: { refId: number; promiseId: number },
    plugins: ((value: unknown) => unknown[] | undefined)[],
    redactErrors: boolean | string,
) {
    const ENCODE_FRAME_TYPE_NEEDS_ENCODING = 1
    const ENCODE_FRAME_TYPE_ALREADY_ENCODED = 2

    class EncodeFrame {
        type: number
        prefix: string
        value: unknown

        constructor(type: number, prefix: string, value: unknown) {
            this.type = type
            this.prefix = prefix
            this.value = value
        }
    }

    const encodeStack: EncodeFrame[] = [new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, "", value)]
    let frame: EncodeFrame | undefined

    encodeLoop: while ((frame = encodeStack.pop()) !== undefined) {
        if (frame.type === ENCODE_FRAME_TYPE_ALREADY_ENCODED) {
            chunks.push(frame.prefix)
            continue
        }

        const { prefix, value: val } = frame
        chunks.push(prefix)

        if (val === undefined) {
            chunks.push(STR_UNDEFINED)
            continue
        }
        if (val === null) {
            chunks.push(STR_NULL)
            continue
        }
        if (val === true) {
            chunks.push(STR_TRUE)
            continue
        }
        if (val === false) {
            chunks.push(STR_FALSE)
            continue
        }

        const typeOfValue = typeof val

        if (typeOfValue === "object") {
            if (val instanceof Promise || typeof (val as any).then === "function") {
                const existingId = promises.get(val as object)
                if (existingId !== undefined) {
                    chunks.push(STR_PROMISE, existingId.toString())
                    continue
                }
                const promiseId = counters.promiseId++
                promises.set(val as object, promiseId)
                chunks.push(STR_PROMISE, promiseId.toString())
                asyncFrames.push([ASYNC_FRAME_TYPE_PROMISE, promiseId, val])
                continue
            }

            if (val instanceof ReadableStream) {
                const existingId = promises.get(val)
                if (existingId !== undefined) {
                    chunks.push(STR_READABLE_STREAM, existingId.toString())
                    continue
                }
                const iterableId = counters.promiseId++
                promises.set(val, iterableId)
                chunks.push(STR_READABLE_STREAM, iterableId.toString())
                asyncFrames.push([
                    ASYNC_FRAME_TYPE_ITERABLE,
                    iterableId,
                    {
                        [Symbol.asyncIterator]: async function* () {
                            const reader = val.getReader()
                            try {
                                while (true) {
                                    const { done, value: chunk } = await reader.read()
                                    if (done) return
                                    yield chunk
                                }
                            } finally {
                                reader.releaseLock()
                            }
                        },
                    },
                ])
                continue
            }

            if (typeof (val as any)[Symbol.asyncIterator] === "function") {
                const existingId = promises.get(val as object)
                if (existingId !== undefined) {
                    chunks.push(STR_ASYNC_ITERABLE, existingId.toString())
                    continue
                }
                const iterableId = counters.promiseId++
                promises.set(val as object, iterableId)
                chunks.push(STR_ASYNC_ITERABLE, iterableId.toString())
                asyncFrames.push([ASYNC_FRAME_TYPE_ITERABLE, iterableId, val])
                continue
            }

            const existingRef = refs.get(val as object)
            if (existingRef !== undefined) {
                chunks.push(STR_REFERENCE_SYMBOL, existingRef.toString())
                continue
            }
            refs.set(val as object, counters.refId++)

            if (val instanceof Date) {
                chunks.push(STR_DATE, '"', val.toJSON(), '"')
            } else if (val instanceof RegExp) {
                chunks.push(STR_REGEXP, JSON.stringify([val.source, val.flags]))
            } else if (val instanceof URL) {
                chunks.push(STR_URL, JSON.stringify(val))
            } else if (val instanceof ArrayBuffer) {
                chunks.push(STR_ARRAY_BUFFER)
                stringifyTypedArray(chunks, new Uint8Array(val))
            } else if (val instanceof Int8Array) {
                chunks.push(STR_INT_8_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Uint8Array) {
                chunks.push(STR_UINT_8_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Uint8ClampedArray) {
                chunks.push(STR_UINT_8_ARRAY_CLAMPED)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Int16Array) {
                chunks.push(STR_INT_16_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Uint16Array) {
                chunks.push(STR_UINT_16_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Int32Array) {
                chunks.push(STR_INT_32_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Uint32Array) {
                chunks.push(STR_UINT_32_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Float32Array) {
                chunks.push(STR_FLOAT_32_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof Float64Array) {
                chunks.push(STR_FLOAT_64_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof BigInt64Array) {
                chunks.push(STR_BIG_INT_64_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof BigUint64Array) {
                chunks.push(STR_BIG_UINT_64_ARRAY)
                stringifyTypedArray(chunks, val)
            } else if (val instanceof DataView) {
                chunks.push(STR_DATA_VIEW)
                stringifyTypedArray(chunks, new Uint8Array(val.buffer, val.byteOffset, val.byteLength))
            } else if (val instanceof FormData) {
                encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, STR_FORM_DATA, Array.from(val.entries() as any)))
            } else if (typeof File !== "undefined" && val instanceof File) {
                encodeStack.push(
                    new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, STR_FILE, {
                        promise: val.arrayBuffer(),
                        size: val.size,
                        type: val.type,
                        name: val.name,
                        lastModified: val.lastModified,
                    }),
                )
            } else if (val instanceof Blob) {
                encodeStack.push(
                    new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, STR_BLOB, {
                        promise: val.arrayBuffer(),
                        size: val.size,
                        type: val.type,
                    }),
                )
            } else if (val instanceof Error) {
                encodeStack.push(
                    new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, STR_ERROR, prepareErrorForEncoding(val, redactErrors)),
                )
            } else if (typeof (val as any).toJSON === "function") {
                const newValue = (val as any).toJSON()
                encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, "", newValue))
                if (typeof newValue === "object") {
                    counters.refId--
                } else {
                    refs.delete(val as object)
                }
            } else {
                const isIterable = typeof (val as any)[Symbol.iterator] === "function"
                if (isIterable) {
                    const isArray = Array.isArray(val)
                    const toEncode = isArray ? (val as unknown[]) : Array.from(val as Iterable<unknown>)
                    encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_ALREADY_ENCODED, "]", undefined))
                    for (let i = toEncode.length - 1; i >= 0; i--) {
                        encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, i === 0 ? "" : ",", toEncode[i]))
                    }
                    chunks.push(
                        isArray
                            ? "["
                            : val instanceof Set
                              ? `${STR_SET}[`
                              : val instanceof Map
                                ? `${STR_MAP}[`
                                : "[",
                    )
                } else {
                    for (let i = 0; i < plugins.length; i++) {
                        const result = plugins[i](val)
                        if (Array.isArray(result)) {
                            encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, STR_PLUGIN, result))
                            counters.refId--
                            refs.delete(val as object)
                            continue encodeLoop
                        }
                    }

                    encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_ALREADY_ENCODED, "}", undefined))
                    const keys = Object.keys(val as object)
                    const end = keys.length
                    const encodeFrames: EncodeFrame[] = new Array(end)
                    for (let i = keys.length - 1; i >= 0; i--) {
                        const key = keys[i]
                        const prefix = i > 0 ? "," : ""
                        encodeFrames[end - 1 - i] = new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, `${prefix}${JSON.stringify(key)}:`, (val as any)[key])
                    }
                    encodeStack.push(...encodeFrames)
                    chunks.push("{")
                }
            }
        } else if (typeOfValue === "string") {
            chunks.push(JSON.stringify(val))
        } else if (typeOfValue === "number") {
            if (nan(val as number)) {
                chunks.push(STR_NaN)
            } else if (val === POSITIVE_INFINITY) {
                chunks.push(STR_INFINITY)
            } else if (val === NEGATIVE_INFINITY) {
                chunks.push(STR_NEGATIVE_INFINITY)
            } else if (Object.is(val, -0)) {
                chunks.push(STR_NEGATIVE_ZERO)
            } else {
                chunks.push((val as number).toString())
            }
        } else if (typeOfValue === "bigint") {
            chunks.push(STR_BIGINT, (val as bigint).toString())
        } else if (typeOfValue === "symbol") {
            const symbolKey = Symbol.keyFor(val as symbol)
            if (typeof symbolKey === "string") {
                chunks.push(STR_SYMBOL, JSON.stringify(symbolKey))
            } else {
                chunks.push(STR_UNDEFINED)
            }
        } else {
            for (let i = 0; i < plugins.length; i++) {
                const result = plugins[i](val)
                if (Array.isArray(result)) {
                    encodeStack.push(new EncodeFrame(ENCODE_FRAME_TYPE_NEEDS_ENCODING, STR_PLUGIN, result))
                    continue encodeLoop
                }
            }
            chunks.push(STR_UNDEFINED)
        }
    }
}

function prepareErrorForEncoding(error: Error, redactErrors: boolean | string): object {
    const shouldRedact =
        redactErrors === true || typeof redactErrors === "string" || typeof redactErrors === "undefined"
    const redacted = typeof redactErrors === "string" ? redactErrors : STR_REDACTED
    return {
        name: shouldRedact ? "Error" : error.name,
        message: shouldRedact ? redacted : error.message,
        stack: shouldRedact ? undefined : error.stack,
        cause: error.cause,
    }
}

function stringifyTypedArray(chunks: ChunkBuffer, content: any) {
    chunks.push('"')
    const chunkSize = 65535 - (65535 % 3)
    for (let i = 0; i < content.length; i += chunkSize) {
        const sub = content.subarray(i, i + chunkSize)
        let binary = ""
        for (let j = 0; j < sub.length; j += 8192) {
            binary += String.fromCharCode.apply(null, [...sub.subarray(j, j + 8192)])
        }
        chunks.push(btoa(binary))
    }
    chunks.push('"')
}
