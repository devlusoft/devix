import { encode } from '../vendor/turbo-encode'
import { decode } from 'turbo-stream'

export async function collectEncode(data: unknown, signal?: AbortSignal): Promise<string> {
    const readable = encode(data, { signal })
    const reader = readable.getReader()
    let result = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += value
    }
    return result
}

export function createTurboResponse(data: unknown, signal?: AbortSignal): Response {
    const readable = encode(data, { signal })
    const encoder = new TextEncoder()
    const transformed = readable.pipeThrough(new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
            controller.enqueue(encoder.encode(chunk))
        }
    }))
    return new Response(transformed, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'transfer-encoding': 'chunked',
        }
    })
}

export async function decodeResponse(response: Response): Promise<any> {
    const decoder = new TextDecoder()
    const stringStream = response.body!.pipeThrough(new TransformStream<Uint8Array, string>({
        transform(chunk, controller) {
            controller.enqueue(decoder.decode(chunk, { stream: true }))
        }
    }))
    return decode(stringStream)
}

export async function decodeFromRequest(request: Request): Promise<any> {
    const decoder = new TextDecoder()
    const stringStream = request.body!.pipeThrough(new TransformStream<Uint8Array, string>({
        transform(chunk, controller) {
            controller.enqueue(decoder.decode(chunk, { stream: true }))
        }
    }))
    return decode(stringStream)
}

