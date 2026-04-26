/**
 * Skeleton shimmer block for loading states.
 * Usage: <Skeleton width={120} height={16} radius={6} />
 */
export function Skeleton({ width = '100%', height = 16, radius = 6, style }) {
  return (
    <>
      <div style={{
        width,
        height,
        borderRadius: radius,
        background: 'rgba(255,255,255,0.06)',
        animation: 'skeletonShimmer 1.5s ease-in-out infinite',
        ...style,
      }} />
      <style>{`@keyframes skeletonShimmer { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </>
  )
}
