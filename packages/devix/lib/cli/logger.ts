import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { c, createLogger, gradient } from '@nijil71/lumi-cli'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getNetworkUrl(port: number): string | null {
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

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

const logger = createLogger({ prefix: 'devix' })

const BRAND_ORANGE = '\x1b[38;2;244;73;2m'
const BOLD = '\x1b[1m'

const WORDMARK = [
  '  ██████╗ ███████╗██╗   ██╗██╗██╗  ██╗',
  '  ██╔══██╗██╔════╝██║   ██║██║╚██╗██╔╝',
  '  ██║  ██║█████╗  ██║   ██║██║ ╚███╔╝ ',
  '  ██║  ██║██╔══╝  ╚██╗ ██╔╝██║ ██╔██╗',
  '  ██████╔╝███████╗ ╚████╔╝ ██║██╔╝ ██╗',
  '  ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝╚═╝  ╚═╝',
].join('\n')

function isSilent(): boolean {
  return (
    process.env.DEVIX_SILENT === 'true' ||
    process.env.CI === 'true' ||
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test'
  )
}

export function showBanner(): void {
  if (isSilent()) return
  console.log('')
  console.log(gradient(WORDMARK, [255, 140, 60], [244, 73, 2]))
  console.log('')
}

export function printBootBanner(opts: {
  port: number
  durationMs: number
  networkUrl?: string
}): void {
  if (isSilent()) return
  const version = getVersion()
  const localUrl = `http://localhost:${opts.port}/`
  const ready = `ready in ${opts.durationMs}ms`
  const networkUrl = opts.networkUrl ?? getNetworkUrl(opts.port)

  console.log('')
  console.log(gradient(WORDMARK, [255, 140, 60], [244, 73, 2]))
  console.log('')
  console.log(`  ${c.mist}v${version}${c.r}    ${c.mist}${ready}${c.r}`)
  console.log('')
  console.log(`  ${BOLD}Local:${c.r}   ${BRAND_ORANGE}${localUrl}${c.r}`)
  if (networkUrl) {
    console.log(`  ${BOLD}Network:${c.r} ${BRAND_ORANGE}${networkUrl}${c.r}`)
  } else {
    console.log(`  ${BOLD}Network:${c.r} ${c.mist}use --host to expose${c.r}`)
  }
  console.log('')
}

export function logReady(urls: { local: string; network?: string }, durationMs: number): void {
  if (isSilent()) return
  logger.info(`ready in ${durationMs}ms`)
  if (urls.local) {
    console.log(`${BOLD}Local:${c.r}   ${BRAND_ORANGE}${urls.local}${c.r}`)
  }
  if (urls.network) {
    console.log(`${BOLD}Network:${c.r} ${BRAND_ORANGE}${urls.network}${c.r}`)
  }
}

function formatTime(date = new Date()): string {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return c.azure
    case 'POST':
      return c.amber
    case 'CLIENT':
      return '\x1b[38;2;180;130;255m'
    default:
      return c.mist
  }
}

function durationColor(ms: number): string {
  if (ms > 1000) return c.signal
  if (ms > 300) return c.amber
  return c.mist
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
  const time = formatTime()
  const symbol = method === 'CLIENT' ? '→' : '▸'
  const methodPadded = method.padEnd(6)
  const pathDisplay = url.length > 26 ? `${url.slice(0, 23)}...` : url
  const pathPadded = pathDisplay.padEnd(26)
  const statusColor =
    status >= 500 ? c.signal : status >= 400 ? c.amber : status >= 300 ? c.azure : c.sage
  const labelText = label ? ` (${label}${pagePath ? ` on ${pagePath}` : ''})` : ''
  console.log(
    `[devix] ${c.mist}${time}${c.r} ${symbol} ${methodColor(method)}${methodPadded}${c.r} ${pathPadded} ${statusColor}${status}${c.r}  ${durationColor(durationMs)}${durationMs}ms${c.r}${labelText}`,
  )
}

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
