import { hasViewTransitions, prefersReducedMotion } from './feature'

export async function withViewTransition(callback: () => void | Promise<void>): Promise<void> {
  if (prefersReducedMotion() || !hasViewTransitions()) {
    await callback()
    return
  }
  return new Promise<void>((resolve) => {
    const transition = document.startViewTransition(callback)
    transition.finished.then(() => resolve()).catch(() => resolve())
  })
}
