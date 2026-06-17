import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { useNavigate } from './hooks'

export type NavigateProps = {
  href: string
  replace?: boolean
  scroll?: boolean
  state?: unknown
}

export function Navigate(props: NavigateProps): JSX.Element {
  const navigate = useNavigate()

  onMount(() => {
    navigate(props.href, {
      replace: props.replace,
      scroll: props.scroll,
      state: props.state,
    })
  })

  return null
}
