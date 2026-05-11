export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

function extractMessage(body: unknown): string | null {
    if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as {message: unknown}).message
        if (typeof m === 'string' && m.length > 0) return m
    }
    return null
}

export class FetchError<E = unknown> extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly response: Response,
        public readonly body?: E,
    ) {
        super(extractMessage(body) ?? `HTTP ${status}: ${statusText}`)
        this.name = 'FetchError'
    }

    get code(): string | undefined {
        if (this.body && typeof this.body === 'object' && 'code' in this.body) {
            const c = (this.body as {code: unknown}).code
            return typeof c === 'string' ? c : undefined
        }
        return undefined
    }
}
