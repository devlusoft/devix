export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export class FetchError<E = unknown> extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly response: Response,
        public readonly body?: E,
    ) {
        super(`HTTP ${status}: ${statusText}`)
        this.name = 'FetchError'
    }
}
