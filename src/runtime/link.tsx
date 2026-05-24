import { useContext } from "solid-js"
import { splitProps } from "solid-js"
import type { JSX } from "solid-js"
import type { NavigateOptions } from './context'
import { RouterContext } from './context'
import { resolveTo } from './url'

interface LinkProps extends Omit<JSX.IntrinsicElements["a"], "onClick" | "onMouseEnter" | "onMouseLeave" | "onTouchStart" | "href"> {
    href: string
    prefetch?: 'hover' | 'none'
    replace?: boolean
    viewTransition?: boolean
}

export function Link(props: LinkProps) {
    const router = useContext(RouterContext)
    const [local, rest] = splitProps(props, ['href', 'prefetch', 'replace', 'viewTransition', 'children', 'class'])
    let hoverTimer: ReturnType<typeof setTimeout> | null = null

    const cancelHoverTimer = () => {
        if (hoverTimer !== null) {
            clearTimeout(hoverTimer)
            hoverTimer = null
        }
    }

    const triggerPrefetch = () => {
        if (!router || local.prefetch === 'none') return
        router.prefetchRoute(local.href)
    }

    const onMouseEnter = () => {
        if (local.prefetch === 'none') return
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
        if (resolveTo(local.href).kind === 'external') return
        e.preventDefault()
        const options: NavigateOptions = { replace: local.replace, viewTransition: local.viewTransition }
        router.navigate(local.href, options)
    }

    return (
        <a
            href={local.href}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            class={props.class}
            {...rest}
        >
            {local.children}
        </a>
    )
}
