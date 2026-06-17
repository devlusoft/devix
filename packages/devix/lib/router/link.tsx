import { createMemo, type JSX, splitProps } from 'solid-js'
import { useLocation, useNavigate } from './hooks'

export type AnchorProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  activeClass?: string
  inactiveClass?: string
  end?: boolean
  replace?: boolean
  scroll?: boolean
  state?: unknown
  children?: JSX.Element
}

function isModifiedEvent(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}

function isSameOrigin(href: string): boolean {
  if (typeof window === 'undefined') return true
  if (href.startsWith('/') || href.startsWith('?') || href.startsWith('#')) return true
  try {
    return new URL(href, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

function isMatch(currentPath: string, target: string, end: boolean): boolean {
  const c = currentPath.split('?')[0].split('#')[0]
  const t = target.split('?')[0].split('#')[0]
  if (end) return c === t
  if (c === t) return true
  return c.startsWith(t === '/' ? '/' : `${t}/`)
}

export function Link(props: AnchorProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'href',
    'activeClass',
    'inactiveClass',
    'end',
    'replace',
    'scroll',
    'state',
    'children',
  ])

  const location = useLocation()
  const navigate = useNavigate()

  const className = createMemo(() => {
    const current = location().pathname
    const active = isMatch(current, local.href, local.end ?? false)
    if (active) return local.activeClass
    return local.inactiveClass
  })

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented) return
    if (e.button !== 0) return
    if (isModifiedEvent(e)) return

    const target = e.currentTarget as HTMLAnchorElement
    if (target.target === '_blank') return
    if (target.hasAttribute('download')) return
    if (!isSameOrigin(local.href)) return

    e.preventDefault()
    navigate(local.href, {
      replace: local.replace,
      scroll: local.scroll,
      state: local.state,
    })
  }

  return (
    <a href={local.href} class={className()} onClick={onClick} {...rest}>
      {local.children}
    </a>
  )
}
