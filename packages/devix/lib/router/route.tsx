import { createMemo, type JSX, type ParentProps, useContext } from 'solid-js'
import { LocationContext } from './context'
import { matchNodePath } from './manifest'

export type RouteProps = ParentProps<{
  path: string
  component?: (props: { params: Record<string, string>; children?: JSX.Element }) => JSX.Element
}>

export function Route(props: RouteProps): JSX.Element {
  const location = useContext(LocationContext)

  const matches = createMemo(() => {
    if (!location) return { hits: false, params: {} as Record<string, string> }
    const pathname = location().pathname
    const parts = pathname.split('/').filter(Boolean)
    const m = matchNodePath(props.path, parts)
    if (!m) return { hits: false, params: {} as Record<string, string> }
    return { hits: m.consumed === parts.length, params: m.params }
  })

  return createMemo(() => {
    const m = matches()
    if (!m.hits) return null
    if (!props.component) return props.children ?? null
    return props.component({ params: m.params, children: props.children })
  }) as unknown as JSX.Element
}
