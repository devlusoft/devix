// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const origConsoleError = console.error
console.error = (...args: any[]) => {
    const msg = args[0] ?? ''
    if (typeof msg === 'string' && (
        msg.includes('[devix] server.') ||
        msg.includes('Not implemented: navigation')
    )) return
    origConsoleError.apply(console, args)
}

const origConsoleWarn = console.warn
console.warn = (...args: any[]) => {
    const msg = args[0] ?? ''
    if (typeof msg === 'string' && msg.includes('Not implemented: navigation')) return
    origConsoleWarn.apply(console, args)
}

const origStderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = function (chunk: any, ...rest: any[]) {
    const str = typeof chunk === 'string' ? chunk : chunk instanceof Buffer ? chunk.toString() : String(chunk)
    if (str.includes('Not implemented: navigation')) return true
    return origStderrWrite(chunk, ...rest)
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        if (target.closest('a[href]')) {
            e.preventDefault()
        }
    }, {capture: true})
}

export { }