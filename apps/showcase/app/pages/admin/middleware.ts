import type { MiddlewareContext, MiddlewareResult } from '@devlusoft/devix/router'
import { isAuthenticated } from '../../../lib/auth'

export default function adminMiddleware(ctx: MiddlewareContext): MiddlewareResult {
  if (!isAuthenticated(ctx.request)) return '/login'
}
