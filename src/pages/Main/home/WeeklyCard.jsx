import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

export function WeeklyCard({ data }) {
  const { t } = useTranslation()
  const { planned, done, extra } = data

  const hasPlan = planned != null && planned > 0

  const totalBars = hasPlan ? Math.max(planned, done) : done
  const bars = []
  for (let i = 0; i < totalBars; i++) {
    if (i < done && i < (planned || done)) bars.push('done')
    else if (i < done) bars.push('extra')
    else bars.push('remaining')
  }

  let contextText
  if (!hasPlan) {
    contextText = t('progress.week.workoutsWeek')
  } else if (extra > 0) {
    contextText = t('progress.week.planDone', { n: extra })
  } else if (done >= planned) {
    contextText = t('progress.week.planComplete')
  } else {
    contextText = t('progress.week.planRemaining', { n: planned - done })
  }

  return (
    <Glass style={{
      padding: 'var(--space-4)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 'var(--space-3)',
      }}>
        <Icon name="calendar" size={14} style={{ color: 'var(--fg-tertiary)' }} />
        <span style={{
          fontSize: 11, fontWeight: 700,
          letterSpacing: 'var(--tracking-caps, 0.08em)',
          textTransform: 'uppercase',
          color: 'var(--fg-tertiary)',
        }}>
          {t('progress.week.title')}
        </span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 6,
        marginBottom: 'var(--space-3)',
      }}>
        <span style={{
          fontSize: 40, fontWeight: 700,
          color: 'var(--fg-primary)', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {done}
        </span>
        {hasPlan && (
          <span style={{
            fontSize: 'var(--text-base)',
            color: 'var(--fg-tertiary)',
          }}>
            {t('progress.week.ofPlanned', { n: planned })}
          </span>
        )}
      </div>

      {totalBars > 0 && (
        <div style={{
          display: 'flex', gap: 6,
          marginBottom: 'var(--space-3)',
        }}>
          {bars.map((type, i) => (
            <div key={i} style={{
              flex: 1, height: 10, borderRadius: 5,
              background: type === 'done'
                ? 'hsla(var(--accent-h,158),50%,40%,0.7)'
                : type === 'extra'
                  ? 'hsla(var(--accent-h,158),50%,40%,0.4)'
                  : 'rgba(255,255,255,0.06)',
            }} />
          ))}
        </div>
      )}

      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--fg-tertiary)',
        lineHeight: 1.4,
      }}>
        {contextText}
      </div>
    </Glass>
  )
}
