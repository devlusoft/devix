import type { JSX } from 'react'

export function TaskListSkeleton({ count = 3 }: { count?: number }): JSX.Element {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton">
          <div className="skeleton-bar wide" />
          <div className="skeleton-bar" />
          <div className="skeleton-bar narrow" />
        </div>
      ))}
    </div>
  )
}

export function TaskDetailSkeleton(): JSX.Element {
  return (
    <div className="card skeleton">
      <div className="skeleton-bar wide" />
      <div className="skeleton-bar" />
      <div className="skeleton-bar" />
    </div>
  )
}