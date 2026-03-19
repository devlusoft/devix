import {vi} from 'vitest'

export const matchClientRoute = vi.fn().mockReturnValue(null)
export const loadErrorPage = vi.fn().mockResolvedValue(null)
export const getDefaultErrorPage = vi.fn().mockReturnValue(null)
