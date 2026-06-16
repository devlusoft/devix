import { getCookie } from '@devlusoft/devix/cookie'

export const SESSION_COOKIE = 'devix_session'

export function isAuthenticated(request?: Request): boolean {
  return getCookie(SESSION_COOKIE, request) !== undefined
}
