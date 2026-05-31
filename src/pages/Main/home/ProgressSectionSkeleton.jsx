import { Glass } from '../../../components/ui/Glass.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'

export function ProgressSectionSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Weekly card skeleton */}
      <Glass style={{ padding: 'var(--space-4)' }}>
        <Skeleton width="30%" height={11} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <Skeleton width={40} height={36} />
          <Skeleton width={120} height={14} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={10} style={{ flex: 1, borderRadius: 5 }} />)}
        </div>
        <Skeleton width="80%" height={11} />
      </Glass>

      {/* Muscle section skeleton */}
      <Skeleton width="55%" height={11} style={{ marginBottom: 'var(--space-3)' }} />
      {[0, 1].map(i => (
        <Glass key={i} style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Skeleton width={100} height={16} style={{ marginBottom: 6 }} />
              <Skeleton width={130} height={11} style={{ marginBottom: 8 }} />
              <Skeleton width={80} height={18} radius={9} />
            </div>
            <Skeleton width={56} height={56} radius="50%" />
          </div>
        </Glass>
      ))}
    </div>
  )
}
