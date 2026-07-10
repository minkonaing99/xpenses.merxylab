import './Skeleton.css'

// Not yet consumed: mock data resolves synchronously so no screen has a real
// loading state yet. Wire in once Phase 4.4/5 add async data fetching.

interface SkeletonProps {
  width: string
  height: string
  circle?: boolean
}

export function Skeleton({ width, height, circle = false }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: circle ? '999px' : undefined }}
    />
  )
}
