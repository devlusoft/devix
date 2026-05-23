import { decode, encode as turboEncode } from 'turbo-stream'

export async function collectTurbo(value: unknown): Promise<string> {
    const readable = turboEncode(value)
    const reader = readable.getReader()
    let result = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += value
    }
    return result
}

export async function decodeTurboResponse(res: Response): Promise<unknown> {
    const decoder = new TextDecoder()
    const stringStream = res.body!.pipeThrough(new TransformStream<Uint8Array, string>({
        transform(chunk, controller) {
            controller.enqueue(decoder.decode(chunk, { stream: true }))
        }
    }))
    return decode(stringStream)
}
