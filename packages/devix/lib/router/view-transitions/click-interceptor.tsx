import { useNavigate } from '@solidjs/router'
import { type JSX, onCleanup, onMount } from 'solid-js'
import { withViewTransition } from './transition'

export function ClickInterceptor(props: { children?: JSX.Element }): JSX.Element {
  const navigate = useNavigate()

  onMount(() => {
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement | null
      if (!target) return

      const link = target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) return

      const href = link.getAttribute('href')
      if (!href) return
      if (link.target === '_blank') return
      if (link.hasAttribute('download')) return
      if (link.origin !== window.location.origin) return

      e.preventDefault()
      void withViewTransition(() => navigate(href))
    }

    document.addEventListener('click', handleClick, { capture: true })
    onCleanup(() => {
      document.removeEventListener('click', handleClick, { capture: true })
    })
  })

  return <>{props.children}</>
}
