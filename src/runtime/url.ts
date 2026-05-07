export type ResolvedTo =
    | { kind: 'internal'; pathname: string; href: string }
    | { kind: 'external'; url: URL }

export function resolveTo(to: string): ResolvedTo {
    const base = new URL(window.location.href)
    if (!base.pathname.endsWith('/')) base.pathname += '/'

    const url = new URL(to, base)

    if (url.origin !== window.location.origin) {
        return { kind: 'external', url }
    }

    const pathname = url.pathname.length > 1
        ? url.pathname.replace(/\/$/, '')
        : url.pathname

    return {
        kind: 'internal',
        pathname,
        href: pathname + url.search + url.hash,
    }
}
