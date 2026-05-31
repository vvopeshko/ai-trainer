import { Glass } from '../../../components/ui/Glass.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'

// ─── WorkoutSkeleton (loading state while checkActive runs) ─────────────

export function WorkoutSkeleton() {
  return (
    <div style={{ background: '#08080B', minHeight: '100vh' }}>
      {/* TopBar skeleton */}
      <div style={{ padding: '12px 12px 8px' }}>
        <Glass variant="strong" padding="8px 8px 8px 6px" radius={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width={32} height={32} radius={9} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={60} height={20} radius={4} />
            <Skeleton width={100} height={9} />
          </div>
          <Skeleton width={32} height={32} radius={9} />
          <Skeleton width={65} height={32} radius={9} />
        </Glass>
      </div>

      <div style={{ padding: '4px 12px 22px' }}>
        {/* Active exercise card skeleton */}
        <Glass radius={16} style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="35%" height={10} />
            <Skeleton width="65%" height={20} />
            <Skeleton width="20%" height={11} />
          </div>
          <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Stepper skeleton */}
            <div style={{
              padding: 14, borderRadius: 13,
              background: 'hsla(var(--accent-h,158),50%,22%,0.25)',
              border: '1px solid hsla(var(--accent-h,158),55%,50%,0.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 11 }}>
                <Skeleton width="30%" height={10} />
                <Skeleton width="20%" height={10} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <Skeleton height={50} radius={10} />
                <Skeleton height={50} radius={10} />
              </div>
              <Skeleton height={46} radius={11} style={{ marginTop: 11 }} />
            </div>
          </div>
        </Glass>

        {/* Upcoming exercises skeleton */}
        <div style={{ marginTop: 18, marginBottom: 6, padding: '0 4px' }}>
          <Skeleton width="25%" height={10} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <Glass key={i} padding="11px 12px" radius={11} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Skeleton width={28} height={28} radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Skeleton width="55%" height={13} />
                <Skeleton width="25%" height={10} />
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
  )
}
