export const SESSION_COOKIE = 'devix_session'

export function isAuthenticated(request?: Request): boolean {
  const cookieHeader =
    request?.headers.get('cookie') ?? (typeof document !== 'undefined' ? document.cookie : '')
  return cookieHeader.includes(`${SESSION_COOKIE}=`)
}
