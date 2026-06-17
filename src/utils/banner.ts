import { createLogger, gradient } from '@nijil71/lumi-cli'
import { networkInterfaces } from 'node:os'

const R = '\x1b[0m'
const C = {
    azure:  (s: string) => `\x1b[38;2;60;160;255m${s}${R}`,
    amber:  (s: string) => `\x1b[38;2;255;185;40m${s}${R}`,
    signal: (s: string) => `\x1b[38;2;255;80;60m${s}${R}`,
    sage:   (s: string) => `\x1b[38;2;80;200;140m${s}${R}`,
    mist:   (s: string) => `\x1b[38;2;150;150;165m${s}${R}`,
    chalk:  (s: string) => `\x1b[38;2;235;235;240m${s}${R}`,
    bold:   (s: string) => `\x1b[1m${s}${R}`,
}

declare const __DEVIX_VERSION__: string

const WORDMARK = [
    '  ██████╗ ███████╗██╗   ██╗██╗██╗  ██╗',
    '  ██╔══██╗██╔════╝██║   ██║██║╚██╗██╔╝',
    '  ██║  ██║█████╗  ██║   ██║██║ ╚███╔╝ ',
    '  ██║  ██║██╔══╝  ╚██╗ ██╔╝██║ ██╔██╗',
    '  ██████╔╝███████╗ ╚████╔╝ ██║██╔╝ ██╗',
    '  ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝╚═╝  ╚═╝',
].join('\n')

function getNetworkUrl(port: number): string | null {
    const nets = networkInterfaces()
    for (const interfaces of Object.values(nets)) {
        for (const net of interfaces ?? []) {
            if (net.family === 'IPv4' && !net.internal) {
                return `http://${net.address}:${port}/`
            }
        }
    }
    return null
}

function isSilent(): boolean {
    return (
        process.env.DEVIX_SILENT === 'true' ||
        process.env.CI === 'true' ||
        process.env.VITEST === 'true' ||
        process.env.NODE_ENV === 'test'
    )
}

const logger = createLogger({ prefix: 'devix' })

export function showBanner(): void {
    if (isSilent()) return
    console.log('')
    console.log(gradient(WORDMARK, [255, 140, 60], [244, 73, 2]))
    console.log('')
}

export function logReady(urls: { local: string; network?: string }, durationMs: number): void {
    if (isSilent()) return
    logger.info(`ready in ${durationMs}ms`)
    if (urls.local) {
        console.log(`${C.bold('Local:')}${R}   ${C.amber(urls.local)}`)
    }
    if (urls.network) {
        console.log(`${C.bold('Network:')}${R} ${C.amber(urls.network)}`)
    } else {
        console.log(`  ${C.bold('Network:')}${R} ${C.mist('use --host to expose')}`)
    }
    console.log('')
}

export function printDevBanner(port: number, durationMs?: number) {
    if (isSilent()) return
    const version = __DEVIX_VERSION__
    const networkUrl = getNetworkUrl(port)
    const readyText = durationMs !== undefined ? C.mist(`ready in ${durationMs}ms`) : ''

    console.log('')
    console.log(gradient(WORDMARK, [255, 140, 60], [244, 73, 2]))
    console.log('')
    console.log(`  ${C.bold(C.amber('devix'))} ${C.mist(`v${version}`)}${readyText ? '  ' + readyText : ''}`)
    console.log('')
    console.log(`  ${C.sage('➜')}  ${C.bold('Local:')}${R}   ${C.azure(`http://localhost:${port}/`)}`)
    if (networkUrl) {
        console.log(`  ${C.sage('➜')}  ${C.bold('Network:')}${R} ${C.azure(networkUrl)}`)
    } else {
        console.log(`  ${C.sage('➜')}  ${C.bold('Network:')}${R} ${C.mist('use --host to expose')}`)
    }
    console.log('')
}
