import { useContext } from "solid-js"
import type { JSX } from "solid-js"
import { NavigateOptions, RouterContext } from './context'
import { resolveTo } from './url'

interface LinkProps extends Omit<JSX.IntrinsicElements["a"], "onClick" | "onMouseEnter" | "onMouseLeave" | "onTouchStart" | "href"> {
    href: string
    prefetch?: 'hover' | 'none'
    replace?: boolean
    viewTransition?: boolean
}

export function Link({ href, prefetch = 'hover', replace = false, viewTransition = false, children, ...props }: LinkProps) {
    const router = useContext(RouterContext)
    let hoverTimer: ReturnType<typeof setTimeout> | null = null

    const cancelHoverTimer = () => {
        if (hoverTimer !== null) {
            clearTimeout(hoverTimer)
            hoverTimer = null
        }
    }

    const triggerPrefetch = () => {
        if (!router || prefetch === 'none') return
        router.prefetchRoute(href)
    }

    const onMouseEnter = () => {
        if (prefetch === 'none') return
        hoverTimer = setTimeout(triggerPrefetch, 50)
    }

    const onMouseLeave = () => {
        cancelHoverTimer()
    }

    const onTouchStart = () => {
        cancelHoverTimer()
        triggerPrefetch()
    }

    const onClick: JSX.EventHandler<HTMLAnchorElement, MouseEvent> = (e) => {
        cancelHoverTimer()
        if (!router) return
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
        if (resolveTo(href).kind === 'external') return
        e.preventDefault()
        const options: NavigateOptions = { replace, viewTransition }
        router.navigate(href, options)
    }

    return (
        <a
            href={href}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            {...props}
        >
            {children}
        </a>
    )
}
