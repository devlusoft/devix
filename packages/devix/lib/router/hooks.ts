import { createMemo, useContext } from 'solid-js'
import {
  type LocationAccessor,
  LocationContext,
  MatchContext,
  NavigateContext,
  type NavigateFn,
  type ParamsAccessor,
} from './context'

export function useLocation(): LocationAccessor {
  const accessor = useContext(LocationContext)
  if (!accessor) {
    throw new Error('useLocation must be used inside a <Router>')
  }
  return accessor
}

export function useNavigate(): NavigateFn {
  const navigate = useContext(NavigateContext)
  if (!navigate) {
    throw new Error('useNavigate must be used inside a <Router>')
  }
  return navigate
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): () => T {
  const accessor = useContext(MatchContext) as ParamsAccessor | undefined
  if (!accessor) {
    throw new Error('useParams must be used inside a <Router>')
  }
  return createMemo(() => accessor() as T)
}

export function useSearchParams<T extends Record<string, string> = Record<string, string>>(): [
  () => T,
  (next: Record<string, string>) => void,
] {
  const location = useLocation()
  const navigate = useNavigate()

  const get = createMemo(() => location().query as T)

  const set = (next: Record<string, string>) => {
    const qs = Object.entries(next)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    const current = location()
    navigate(`${current.pathname}${qs ? `?${qs}` : ''}${current.hash}`)
  }

  return [get, set]
}
