import { AnchorHTMLAttributes, MouseEventHandler, useCallback, useContext, useRef } from "react"
import { NavigateOptions, RouterContext } from './context'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    prefetch?: 'hover' | 'none'
    replace?: boolean
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

export function Link({ href, prefetch = 'hover', replace = false, viewTransition = false, children, ...props }: LinkProps) {
    const router = useContext(RouterContext)
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const cancelHoverTimer = useCallback(() => {
        if (hoverTimerRef.current !== null) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
        }
    }, [])

    const triggerPrefetch = useCallback(() => {
        if (!router || prefetch === 'none') return
        router.prefetchRoute(resolveHref(href))
    }, [href, prefetch, router])

    const handleMouseEnter = useCallback(() => {
        if (prefetch === 'none') return
        hoverTimerRef.current = setTimeout(triggerPrefetch, 50)
    }, [prefetch, triggerPrefetch])

    const handleMouseLeave = useCallback(() => {
        cancelHoverTimer()
    }, [cancelHoverTimer])

    const handleTouchStart = useCallback(() => {
        cancelHoverTimer()
        triggerPrefetch()
    }, [cancelHoverTimer, triggerPrefetch])

    const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
        cancelHoverTimer()
        if (!router) return
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
            e.preventDefault()
            const options: NavigateOptions = { replace, viewTransition }
            router.navigate(resolveHref(href), options)
        }
    }

    return (
        <a
            href={href}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            {...props}
        >
            {children}
        </a>
    )
}