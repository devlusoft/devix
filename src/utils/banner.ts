import pc from 'picocolors'
import {networkInterfaces} from 'node:os'
import {createRequire} from 'node:module'

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

export function printDevBanner(port: number) {
    const req = createRequire(import.meta.url)
    const version = req('../../package.json').version
    const networkUrl = getNetworkUrl(port)

    console.log()
    console.log(`  ${pc.bold(pc.yellow('devix'))} ${pc.dim(`v${version}`)}`)
    console.log()
    console.log(`  ${pc.green('➜')}  ${pc.bold('Local:')}   ${pc.cyan(`http://localhost:${port}/`)}`)
    if (networkUrl) {
        console.log(`  ${pc.green('➜')}  ${pc.bold('Network:')} ${pc.cyan(networkUrl)}`)
    } else {
        console.log(`  ${pc.green('➜')}  ${pc.bold('Network:')} ${pc.dim('use --host to expose')}`)
    }
    console.log()
}