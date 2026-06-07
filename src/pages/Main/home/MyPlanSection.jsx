import { useMemo } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Icon } from '../../../components/ui/Icon.jsx'

/**
 * MyPlanSection — "Мой план" card with weekly progress bars and day list.
 */
export function MyPlanSection({ planAdherence, program, onProgramTap }) {
  const { t } = useTranslation()

  const days = program?.planJson?.days || []
  const planned = planAdherence?.planned || days.length
  const done = planAdherence?.done || 0
  const doneDayIndices = useMemo(() => new Set(planAdherence?.doneDayIndices || []), [planAdherence?.doneDayIndices])

  // Week date range string (e.g. "2 июн – 8 июн")
  const weekRange = useMemo(() => {
    if (!planAdherence?.weekStart) return ''
    const [y, m, d] = planAdherence.weekStart.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    const sD = start.getDate()
    const sM = months[start.getMonth()]
    const eD = end.getDate()
    const eM = months[end.getMonth()]
    return sM === eM ? `${sD}–${eD} ${sM}` : `${sD} ${sM} – ${eD} ${eM}`
  }, [planAdherence])

  const remaining = Math.max(0, planned - done)

  return (
    <div style={{ padding: '0 18px', marginTop: 22 }}>
      {/* Section title */}
      <h2 style={{
        fontSize: 22,
        fontWeight: 800,
        color: 'var(--gd-ink)',
        margin: '0 0 14px 0',
      }}>
        {t('home.myPlan')}
      </h2>

      {/* Card */}
      <div style={{
        background: 'var(--gd-card)',
        borderRadius: 24,
        padding: 18,
        boxShadow: 'var(--gd-card-shadow)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}>
          {/* Icon square */}
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: 'var(--gd-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}>
            <Icon name="calendar" size={22} strokeWidth={1.8} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--gd-ink)',
            }}>
              {t('home.weekProgress')}
            </div>
            <div style={{
              fontSize: 11.5,
              color: 'var(--gd-sub)',
              marginTop: 2,
            }}>
              {weekRange}
            </div>
          </div>

          <Icon name="chevronDown" size={16} style={{ color: 'var(--gd-faint)' }} />
        </div>

        {/* Progress bars grid */}
        {planned > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(planned, 7)}, 1fr)`,
            gap: 8,
            marginBottom: 16,
          }}>
            {Array.from({ length: planned }).map((_, i) => (
              <div key={i} style={{
                height: 9,
                borderRadius: 5,
                background: i < done ? 'var(--gd-accent)' : 'var(--gd-accent-soft)',
              }} />
            ))}
          </div>
        )}

        {/* Week rules */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '12px 0',
          borderTop: `1px solid var(--gd-line-soft)`,
          borderBottom: `1px solid var(--gd-line-soft)`,
          marginBottom: 14,
        }}>
          <Icon name="info" size={14} strokeWidth={1.8} style={{
            color: 'var(--gd-faint)',
            marginTop: 1,
            flexShrink: 0,
          }} />
          <div>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--gd-faint)',
              marginBottom: 4,
            }}>
              {t('home.weekRulesLabel')}
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--gd-sub)',
              lineHeight: 1.45,
            }}>
              {t('home.weekRulesText', {
                name: program?.name || '',
                n: planned,
                done,
                left: remaining,
              })}
            </div>
          </div>
        </div>

        {/* Day list */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 14,
        }}>
          {days.map((day, idx) => {
            const isDone = doneDayIndices.has(idx)
            return (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 14,
                background: isDone ? 'hsla(150,60%,30%,0.15)' : 'var(--gd-chip)',
              }}>
                {/* Status icon */}
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: isDone ? 'hsla(150,60%,30%,0.5)' : 'var(--gd-inset)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon
                    name={isDone ? 'check' : 'dumbbell'}
                    size={14}
                    strokeWidth={2.2}
                    style={{ color: isDone ? 'hsl(150,70%,60%)' : 'var(--gd-sub)' }}
                  />
                </div>

                {/* Day text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isDone ? 'hsl(150,70%,60%)' : 'var(--gd-ink)',
                  }}>
                    {t('home.dayN', { n: idx + 1 })} · {day.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--gd-sub)',
                    marginTop: 2,
                  }}>
                    {t('home.nExercises', { n: day.exercises?.length || 0 })}
                  </div>
                </div>

                {isDone && (
                  <Icon name="check" size={16} strokeWidth={2.2} style={{ color: 'hsl(150,70%,60%)' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* "Детали плана" button */}
        <button
          onClick={onProgramTap}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 16,
            background: 'var(--gd-chip)',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--gd-ink)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {t('home.planDetails')}
          <Icon name="chevronRight" size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
