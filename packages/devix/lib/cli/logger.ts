import { createLogger } from '@nijil71/lumi-cli'

const R = '\x1b[0m'
const C = {
    azure:   (s: string) => `\x1b[38;2;60;160;255m${s}${R}`,
    amber:   (s: string) => `\x1b[38;2;255;185;40m${s}${R}`,
    signal:  (s: string) => `\x1b[38;2;255;80;60m${s}${R}`,
    sage:    (s: string) => `\x1b[38;2;80;200;140m${s}${R}`,
    mist:    (s: string) => `\x1b[38;2;150;150;165m${s}${R}`,
    chalk:   (s: string) => `\x1b[38;2;235;235;240m${s}${R}`,
    bold:    (s: string) => `\x1b[1m${s}${R}`,
    reset:   (s: string) => `${s}${R}`,
    client:  (s: string) => `\x1b[38;2;180;130;255m${s}${R}`,
}

function isSilent(): boolean {
    return (
        process.env.DEVIX_SILENT === 'true' ||
        process.env.CI === 'true' ||
        process.env.VITEST === 'true' ||
        process.env.NODE_ENV === 'test'
    )
}

function formatTime(date = new Date()): string {
    return date.toLocaleTimeString('en-US', { hour12: false })
}

function methodColor(method: string): (s: string) => string {
    switch (method) {
        case 'GET':       return C.azure
        case 'POST':      return C.amber
        case 'DELETE':    return C.signal
        case 'PUT':
        case 'PATCH':     return C.amber
        case 'CLIENT':    return C.client
        default:          return C.mist
    }
}

function statusColor(status: number): (s: string) => string {
    if (status >= 500) return C.signal
    if (status >= 400) return C.amber
    if (status >= 300) return C.azure
    if (status >= 200) return C.sage
    return C.mist
}

function durationColor(ms: number): (s: string) => string {
    if (ms > 1000) return C.signal
    if (ms > 300) return C.amber
    return C.mist
}

const logger = createLogger({ prefix: 'devix' })

export function logInfo(message: string): void {
    if (isSilent()) return
    logger.info(message)
}

export function logSuccess(message: string): void {
    if (isSilent()) return
    logger.success(message)
}

export function logError(message: string): void {
    if (isSilent()) return
    logger.error(message)
}

export function logWarn(message: string): void {
    if (isSilent()) return
    logger.warn(message)
}

export function logRequest(
    method: string,
    url: string,
    status: number,
    durationMs: number,
    label?: string,
    pagePath?: string,
): void {
    if (isSilent()) return
    const time = C.mist(formatTime())
    const symbol = method === 'CLIENT' ? '→' : '▸'
    const methodPadded = method.padEnd(6)
    const pathDisplay = url.length > 26 ? `${url.slice(0, 23)}...` : url
    const pathPadded = pathDisplay.padEnd(26)
    const labelText = label
        ? C.mist(` (${label}${pagePath ? ` on ${pagePath}` : ''})`)
        : ''
    console.log(
        `${C.mist('[devix]')} ${time} ${symbol} ${methodColor(method)(methodPadded)} ${pathPadded} ${statusColor(status)(String(status))}  ${durationColor(durationMs)(`${durationMs}ms`)}${labelText}`,
    )
}
