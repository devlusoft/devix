import { createContext } from 'solid-js'

export type LocationState = {
  pathname: string
  search: string
  hash: string
  query: Record<string, string>
  path: string
}

export type LocationAccessor = () => LocationState

export type NavigateOptions = {
  replace?: boolean
  scroll?: boolean
  state?: unknown
}

export type NavigateFn = (to: string, options?: NavigateOptions) => void

export type ParamsAccessor<T extends Record<string, string> = Record<string, string>> = () => T

export const LocationContext = createContext<LocationAccessor>()

export const NavigateContext = createContext<NavigateFn>()

export const MatchContext = createContext<ParamsAccessor>()
