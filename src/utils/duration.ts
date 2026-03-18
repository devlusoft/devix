export function parseDuration(value: number | string): number {
    if (typeof value === 'number') return value
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/)
    if (!match) throw new Error(`[devix] Invalid duration: "${value}". Use a number (ms) or a string like "5s", "2m", "500ms".`)
    const n = parseFloat(match[1])
    switch (match[2]) {
        case 'h':  return n * 3_600_000
        case 'm':  return n * 60_000
        case 's':  return n * 1_000
        case 'ms':
        default:   return n
    }
}
