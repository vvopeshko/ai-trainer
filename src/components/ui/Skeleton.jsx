/**
 * Skeleton shimmer block for loading states.
 * Usage: <Skeleton width={120} height={16} radius={6} />
 */
export function Skeleton({ width = '100%', height = 16, radius = 6, style }) {
  // keyframes skeletonShimmer — в styles/index.css
  return (
    <div style={{
      width,
      height,
      borderRadius: radius,
      background: 'rgba(255,255,255,0.06)',
      animation: 'skeletonShimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}
