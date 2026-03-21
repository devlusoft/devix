import {AnchorHTMLAttributes, MouseEventHandler, useCallback, useContext} from "react";
import {matchClientRoute} from "virtual:devix/client-routes";
import {RouterContext} from 'virtual:devix/context'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    prefetch?: boolean
    viewTransition?: boolean
}

function resolveHref(href: string): string {
    if (href.startsWith('/') || href.startsWith('http')) return href
    const base = window.location.pathname.endsWith('/')
        ? window.location.href
        : window.location.href + '/'
    const resolved = new URL(href, base).pathname
    return resolved.length > 1 ? resolved.replace(/\/$/, '') : resolved
}

export function Link({ href, prefetch = false, viewTransition = false, children, ...props }: LinkProps) {
    const router = useContext(RouterContext)

    const handleMouseEnter = useCallback(() => {
        if (!prefetch) return
        const resolved = resolveHref(href)
        const pathname = resolved.split('?')[0].split('#')[0]
        const matched = matchClientRoute(pathname)
        if (matched) {
            matched.load().catch(() => {})
            fetch(`/_data${resolved}`, { headers: { Accept: 'application/json' } }).catch(() => {})
        }
    }, [href, prefetch])

    const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
        if (!router) return
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
            e.preventDefault()
            const resolved = resolveHref(href)
            if (viewTransition && typeof document.startViewTransition === 'function') {
                document.startViewTransition(() => router.navigate(resolved))
            } else {
                router.navigate(resolved)
            }
        }
    }

    return (
        <a href={href} onClick={handleClick} onMouseEnter={handleMouseEnter} {...props}>
            {children}
        </a>
    )
}