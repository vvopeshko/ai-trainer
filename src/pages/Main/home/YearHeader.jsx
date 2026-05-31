import { useTranslation } from '../../../i18n/useTranslation.js'
import { useTelegram } from '../../../components/TelegramProvider.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'

export function YearHeader({ done, target, loading }) {
  const { t } = useTranslation()
  const { user } = useTelegram()

  const initial = (user?.firstName || 'U')[0].toUpperCase()
  const pct = target > 0 ? Math.min(done / target, 1) : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Skeleton width={44} height={44} radius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width="55%" height={12} />
          <Skeleton height={6} radius={3} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      {/* Avatar circle */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#0a1815',
        flexShrink: 0,
      }}>
        {initial}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--fg-secondary)',
          marginBottom: 4,
        }}>
          {t('home.yearGoal', { done, target })}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct * 100}%`,
            borderRadius: 3,
            background: 'hsl(var(--accent-h,158),55%,55%)',
            transition: 'width 0.4s ease-out',
          }} />
        </div>
      </div>
    </div>
  )
}
