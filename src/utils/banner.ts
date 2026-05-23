import { c, gradient } from '@nijil71/lumi-cli'
import { networkInterfaces } from 'node:os'

declare const __DEVIX_VERSION__: string

const brandOrange = '\x1b[38;2;244;73;2m'

const wordmark = [
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

export function printDevBanner(port: number, startTime?: number): void {
    const version = __DEVIX_VERSION__
    const networkUrl = getNetworkUrl(port)
    const localUrl = `http://localhost:${port}/`
    const ready = startTime ? `ready in ${Date.now() - startTime}ms` : ''

    console.log('')
    console.log(gradient(wordmark, [255, 140, 60], [244, 73, 2]))
    console.log()

    const left = `  ${c.fog}v${version}${c.r}`
    if (ready) {
        console.log(`${left}    ${c.fog}${ready}${c.r}`)
    } else {
        console.log(left)
    }

    console.log()
    console.log(`  ${c.b}Local:${c.r}   ${brandOrange}${localUrl}${c.r}`)
    if (networkUrl) {
        console.log(`  ${c.b}Network:${c.r} ${brandOrange}${networkUrl}${c.r}`)
    } else {
        console.log(`  ${c.b}Network:${c.r} ${c.fog}use --host to expose${c.r}`)
    }
    console.log('')
}
