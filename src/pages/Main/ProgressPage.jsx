/**
 * Progress Page — экран прогресса (BRD §12.4, Phase 1).
 *
 * Дизайн: ring charts + dot ladders + capsule bars (glass_v4).
 * Секции: WeeklyCard → MuscleGroupCards → MonthlyRecordsList.
 * Три состояния: has_data (≥3), mostly_empty (1–2), empty (0).
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { useProgressData } from '../../contexts/ProgressDataContext.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────

const MUSCLE_ICONS = {
  chest: 'chest', back: 'back', shoulders: 'shoulder',
  arms: 'arm', legs: 'leg', core: 'abs',
}

function getMin(target) {
  if (!target || target <= 0) return 0
  return Math.max(1, Math.ceil(target * 0.65))
}

function getStatus(actual, target) {
  if (!target || target <= 0) return 'none'
  const min = getMin(target)
  if (actual === 0) return 'none'
  if (actual < min) return 'low'
  if (actual <= target) return 'optimal'
  if (actual <= Math.ceil(target * 1.4)) return 'over'
  return 'overload'
}

const STATUS_STYLES = {
  none: { ring: 'var(--fg-disabled)', badge: 'transparent', text: 'var(--fg-disabled)' },
  low: { ring: 'hsl(35,80%,55%)', badge: 'hsla(35,80%,50%,0.15)', text: 'hsl(35,80%,60%)' },
  optimal: { ring: 'hsl(140,55%,55%)', badge: 'hsla(140,55%,45%,0.15)', text: 'hsl(140,55%,60%)' },
  over: { ring: 'hsl(140,55%,55%)', badge: 'hsla(140,55%,45%,0.15)', text: 'hsl(140,55%,60%)' },
  overload: { ring: 'hsl(0,65%,55%)', badge: 'hsla(0,60%,50%,0.15)', text: 'hsl(0,65%,65%)' },
}

// ─── Ring Chart (SVG) ────────────────────────────────────────────────

function RingChart({ actual, target, size = 56 }) {
  const min = getMin(target)
  const max = target || 0
  const status = getStatus(actual, target)
  const colors = STATUS_STYLES[status]

  if (!target || target <= 0) {
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.32, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--fg-secondary)',
        }}>{actual}</span>
      </div>
    )
  }

  const overflow = Math.max(2, Math.ceil(max * 0.4))
  const scale = Math.max(actual, max + overflow, min + 1)
  const r = size / 2 - 4
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const angOf = (s) => (s / scale) * 360

  const greenLen = circ * ((angOf(max) - angOf(min)) / 360)
  const fillLen = circ * Math.min(1, actual / scale)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {status === 'overload' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          boxShadow: '0 0 14px 2px hsla(0,65%,50%,0.45)',
        }} />
      )}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r}
          stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
        {/* Target zone arc (green, semi-transparent) */}
        <circle cx={cx} cy={cy} r={r}
          stroke="hsla(140,55%,55%,0.25)" strokeWidth={5} fill="none"
          strokeDasharray={`${greenLen} ${circ}`}
          strokeDashoffset={`${-circ * (angOf(min) / 360)}`} />
        {/* Filled arc */}
        {actual > 0 && (
          <circle cx={cx} cy={cy} r={r}
            stroke={colors.ring} strokeWidth={5} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${circ}`}
            strokeDashoffset="0" />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.3, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: colors.ring,
        }}>{actual}</span>
      </div>
    </div>
  )
}

// ─── Dot Ladder ──────────────────────────────────────────────────────

function DotLadder({ actual, min, max }) {
  const effectiveMax = max || actual
  const maxDots = Math.min(Math.max(actual, effectiveMax), effectiveMax + 8)
  const overflowCount = actual > maxDots ? actual - maxDots : 0

  const elements = []
  for (let i = 1; i <= maxDots; i++) {
    // Insert min marker before dot #min
    if (min && i === min) {
      elements.push(
        <span key={`ml-${i}`} style={{
          width: 1, height: 12, background: 'rgba(255,255,255,0.3)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }

    // Dot color
    let bg, border
    if (i > actual) {
      bg = 'transparent'
      border = '1.5px solid rgba(255,255,255,0.1)'
    } else if (min && i < min) {
      bg = 'rgba(255,255,255,0.3)'
      border = 'none'
    } else if (max && i > max) {
      bg = 'hsl(0,65%,60%)'
      border = 'none'
    } else {
      bg = 'hsl(140,55%,55%)'
      border = 'none'
    }

    elements.push(
      <span key={`d-${i}`} style={{
        width: 7, height: 7, borderRadius: '50%',
        background: bg, border, flexShrink: 0,
      }} />
    )

    // Insert max marker after dot #max
    if (max && i === max) {
      elements.push(
        <span key={`mr-${i}`} style={{
          width: 1, height: 12, background: 'rgba(255,255,255,0.3)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }
  }

  if (overflowCount > 0) {
    elements.push(
      <span key="overflow" style={{
        fontSize: 10, color: 'hsl(0,65%,60%)',
        marginLeft: 2, flexShrink: 0,
      }}>+{overflowCount}</span>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: 3, flexWrap: 'wrap',
    }}>
      {elements}
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────

function StatusBadge({ actual, target, t }) {
  const status = getStatus(actual, target)
  if (status === 'none') return null

  const styles = STATUS_STYLES[status]
  const diff = actual - (target || 0)

  let label
  if (status === 'low') label = t('progress.status.low', { n: getMin(target) - actual })
  else if (status === 'optimal') label = t('progress.status.optimal')
  else if (status === 'over') label = t('progress.status.over', { n: diff })
  else label = t('progress.status.overload', { n: diff })

  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 6,
      background: styles.badge, color: styles.text,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────

function ProgressSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header skeleton */}
      <div>
        <Skeleton width="40%" height={24} style={{ marginBottom: 6 }} />
        <Skeleton width="65%" height={12} />
      </div>

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
      <div>
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
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyProgress() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 'var(--space-4)',
      }}>
        <Icon name="activity" size={28} style={{ color: 'var(--fg-disabled)' }} />
      </div>
      <div style={{
        fontSize: 'var(--text-base)', fontWeight: 600,
        color: 'var(--fg-primary)', marginBottom: 'var(--space-2)',
      }}>
        {t('progress.emptyTitle')}
      </div>
      <div style={{
        fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)',
        marginBottom: 'var(--space-5)', maxWidth: 260,
      }}>
        {t('progress.emptyDescription')}
      </div>
      <Button variant="accent" icon="play" onClick={() => navigate('/')}>
        {t('progress.goTrain')}
      </Button>
    </div>
  )
}

// ─── Weekly Adherence Card ───────────────────────────────────────────

function WeeklyCard({ data }) {
  const { t } = useTranslation()
  const { planned, done, extra } = data
  const hasPlan = planned != null && planned > 0

  // Capsule bars
  const totalBars = hasPlan ? Math.max(planned, done) : done
  const bars = []
  for (let i = 0; i < totalBars; i++) {
    if (i < done && i < (planned || done)) bars.push('done')
    else if (i < done) bars.push('extra')
    else bars.push('remaining')
  }

  // Context text
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
      borderLeft: '3px solid hsl(var(--accent-h,158),55%,45%)',
    }}>
      {/* Label */}
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

      {/* Big number + subtitle */}
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

      {/* Capsule bars */}
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

      {/* Context text */}
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

// ─── Muscle Group Card ───────────────────────────────────────────────

function MuscleGroupCard({ group }) {
  const { t } = useTranslation()
  const iconName = MUSCLE_ICONS[group.group] || 'activity'
  const hasTarget = group.setsTarget != null && group.setsTarget > 0
  const min = getMin(group.setsTarget)
  const max = group.setsTarget

  return (
    <Glass style={{ padding: 'var(--space-4)' }}>
      {/* Header row: icon + name + target + ring */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 'var(--space-3)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Icon + name */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            marginBottom: 4,
          }}>
            <Icon name={iconName} size={18} style={{
              color: 'hsl(var(--accent-h,158),55%,72%)',
            }} />
            <span style={{
              fontSize: 'var(--text-base)', fontWeight: 600,
              color: 'var(--fg-primary)',
            }}>
              {group.nameRu}
            </span>
          </div>

          {/* Target range */}
          {hasTarget && (
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
              marginBottom: 6,
            }}>
              {t('progress.muscle.target', { min, max })}
            </div>
          )}

          {/* Status badge */}
          <StatusBadge actual={group.setsActual} target={group.setsTarget} t={t} />
        </div>

        {/* Ring chart */}
        <RingChart actual={group.setsActual} target={group.setsTarget} size={56} />
      </div>

      {/* Sub-muscles */}
      {group.subMuscles && group.subMuscles.length > 1 && (
        <>
          <div style={{
            height: 1, background: 'rgba(255,255,255,0.05)',
            margin: 'var(--space-3) 0',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {group.subMuscles.map(sub => {
              const subMin = getMin(sub.setsTarget)
              const subMax = sub.setsTarget

              return (
                <div key={sub.muscle}>
                  {/* Name + count */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 'var(--text-sm)', color: 'var(--fg-primary)',
                    }}>
                      {sub.nameRu}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', gap: 2,
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: 'var(--text-sm)', fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: STATUS_STYLES[getStatus(sub.setsActual, sub.setsTarget)].text,
                      }}>
                        {sub.setsActual}
                      </span>
                      {sub.setsTarget && (
                        <span style={{
                          fontSize: 10, color: 'var(--fg-disabled)',
                        }}>
                          /{subMin}–{subMax}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dot ladder */}
                  <DotLadder
                    actual={sub.setsActual}
                    min={sub.setsTarget ? subMin : null}
                    max={sub.setsTarget ? subMax : null}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Single sub-muscle: show dots for the group itself */}
      {group.subMuscles && group.subMuscles.length === 1 && (
        <>
          <div style={{
            height: 1, background: 'rgba(255,255,255,0.05)',
            margin: 'var(--space-3) 0',
          }} />
          <DotLadder
            actual={group.setsActual}
            min={hasTarget ? min : null}
            max={hasTarget ? max : null}
          />
        </>
      )}
    </Glass>
  )
}

// ─── Monthly Records ─────────────────────────────────────────────────

function MonthlyRecordsList({ records }) {
  const { t } = useTranslation()

  if (!records || records.length === 0) return null

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        <Icon name="trophy" size={16} style={{ color: 'hsl(45,80%,60%)' }} />
        {t('progress.records.title')}
      </div>
      <Glass padding={0} style={{ overflow: 'hidden' }}>
        {records.map((r, i) => {
          const diff = r.previousBest > 0 ? r.value - r.previousBest : r.value
          return (
            <div key={`${r.exerciseSlug}-${i}`} style={{
              padding: '12px 14px',
              borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', gap: 'var(--space-3)',
            }}>
              <div style={{
                fontSize: 'var(--text-sm)', color: 'var(--fg-primary)',
                flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {r.exerciseNameRu}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)', fontWeight: 600,
                color: 'hsl(140,55%,55%)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {t('progress.records.plus', { kg: diff % 1 === 0 ? diff : diff.toFixed(1) })}
              </div>
            </div>
          )
        })}
      </Glass>
    </div>
  )
}

// ─── Hint Card (mostly_empty) ────────────────────────────────────────

function MostlyEmptyHint() {
  const { t } = useTranslation()

  return (
    <Glass style={{
      padding: 'var(--space-4)',
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    }}>
      <Icon name="sparkles" size={20} style={{ color: 'hsl(var(--accent-h,158),55%,72%)', flexShrink: 0 }} />
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>
        {t('progress.mostlyEmpty')}
      </div>
    </Glass>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export default function ProgressPage() {
  const { t } = useTranslation()
  const { state, planAdherence, muscleVolume, records, loaded, refresh } = useProgressData()

  useEffect(() => { refresh() }, [refresh])

  if (!loaded) {
    return (
      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
        <ProgressSkeleton />
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
        <EmptyProgress />
      </div>
    )
  }

  // Filter muscle groups with data
  const visibleMuscles = (muscleVolume || []).filter(
    g => g.setsActual > 0 || (g.setsTarget != null && g.setsTarget > 0)
  )

  return (
    <div style={{
      padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
    }}>
      {/* Page header */}
      <div>
        <div style={{
          fontSize: 'var(--text-2xl)', fontWeight: 700,
          color: 'var(--fg-primary)', marginBottom: 4,
        }}>
          {t('progress.title')}
        </div>
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)',
        }}>
          {t('progress.subtitle')}
        </div>
      </div>

      {/* Weekly adherence */}
      {planAdherence && <WeeklyCard data={planAdherence} />}

      {/* Muscle volume section */}
      {visibleMuscles.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: 'var(--tracking-caps, 0.08em)',
            textTransform: 'uppercase',
            color: 'var(--fg-tertiary)',
            marginBottom: 'var(--space-3)',
          }}>
            {t('progress.muscle.sectionTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {visibleMuscles.map(g => (
              <MuscleGroupCard key={g.group} group={g} />
            ))}
          </div>
        </div>
      )}

      {/* Monthly records */}
      {records && <MonthlyRecordsList records={records} />}

      {/* Mostly empty hint */}
      {state === 'mostly_empty' && <MostlyEmptyHint />}
    </div>
  )
}
