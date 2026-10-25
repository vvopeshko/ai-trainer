import { useMemo } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Icon } from '../../../components/ui/Icon.jsx'

/**
 * MyPlanSection — компактная карточка "Мой план": прогресс недели + статус.
 * Вся карточка — кнопка, ведёт в детали программы.
 */
export function MyPlanSection({ planAdherence, program, onProgramTap }) {
  const { t } = useTranslation()

  const planned = planAdherence?.planned || program?.planJson?.days?.length || 0
  const done = planAdherence?.done || 0

  // Week date range string (e.g. "2 июн – 8 июн")
  const weekRange = useMemo(() => {
    if (!planAdherence?.weekStart) return ''
    const [y, m, d] = planAdherence.weekStart.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const months = t('home.monthsShort').split(',')
    const sD = start.getDate()
    const sM = months[start.getMonth()]
    const eD = end.getDate()
    const eM = months[end.getMonth()]
    return sM === eM ? `${sD}–${eD} ${sM}` : `${sD} ${sM} – ${eD} ${eM}`
  }, [planAdherence, t])

  const remaining = Math.max(0, planned - done)
  const isDone = planned > 0 && remaining === 0

  return (
    <div style={{ padding: '0 18px', marginTop: 22 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--gd-faint)',
        margin: '0 0 10px 0',
      }}>
        {t('home.myPlan')}
      </h2>

      <button
        type="button"
        onClick={onProgramTap}
        aria-label={`${t('home.planDetails')}: ${t('home.weekProgressA11y', { done, n: planned })}`}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
          border: 'none',
          background: 'var(--gd-card)',
          borderRadius: 20,
          padding: '14px 16px',
          boxShadow: 'var(--gd-card-shadow)',
          cursor: 'pointer',
        }}
      >
        {/* Header: title + range · counter + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gd-ink)', whiteSpace: 'nowrap' }}>
              {t('home.weekProgress')}
            </span>
            <span style={{ fontSize: 12, color: 'var(--gd-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {weekRange}
            </span>
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: done > 0 ? 'var(--gd-accent-ink)' : 'var(--gd-ink)' }}>{done}</span>
            <span style={{ fontSize: 14, color: 'var(--gd-sub)' }}> / {planned}</span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2} style={{ color: 'var(--gd-faint)', flexShrink: 0 }} />
        </div>

        {/* Progress segments */}
        {planned > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(planned, 7)}, 1fr)`,
            gap: 6,
            margin: '10px 0',
          }}>
            {Array.from({ length: planned }).map((_, i) => (
              <div key={i} style={{
                height: 6,
                borderRadius: 3,
                background: i < done ? 'var(--gd-accent)' : 'var(--gd-accent-soft)',
              }} />
            ))}
          </div>
        )}

        {/* Program name · status in one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ flex: 1, minWidth: 0, color: 'var(--gd-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {program?.name}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
            color: isDone ? 'var(--gd-success)' : 'var(--gd-sub)',
            fontWeight: isDone ? 600 : 500,
          }}>
            {isDone && <Icon name="check" size={14} strokeWidth={2.4} />}
            {isDone ? t('home.weekPlanDone') : t('home.weekLeft', { n: remaining })}
          </span>
        </div>
      </button>
    </div>
  )
}
