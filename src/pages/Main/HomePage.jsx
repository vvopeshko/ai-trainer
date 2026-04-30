/**
 * Home Page — главный экран мини-аппа (BRD §12.1).
 *
 * Секции: YearHeader → ProgrammeHero → WeeklyCard → MuscleGroups → Records.
 * Данные: HomeDataContext + ProgressDataContext.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { apiPost, apiPatch, apiDelete } from '../../utils/api.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'
import { useProgressData } from '../../contexts/ProgressDataContext.jsx'

// ─── Year Header ────────────────────────────────────────────────────────

function YearHeader({ done, target, loading }) {
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

// ─── Unified ProgrammeHero (programme + hero in one Glass) ──────────────

function calcElapsed(startedAt, totalPausedMs, pausedAt) {
  const start = new Date(startedAt).getTime()
  const paused = totalPausedMs || 0
  if (pausedAt) {
    return Math.max(0, Math.floor((new Date(pausedAt).getTime() - start - paused) / 1000))
  }
  return Math.max(0, Math.floor((Date.now() - start - paused) / 1000))
}

function getRelativeStart(startedAt, t) {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
  if (mins < 1) return t('home.startedJustNow')
  if (mins < 60) return t('home.startedMinAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  return t('home.startedHourAgo', { n: hours })
}

function ProgrammeHeroSkeleton() {
  return (
    <Glass padding={0} style={{
      marginBottom: 'var(--space-5)',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, hsla(var(--accent-h,158),40%,18%,0.55) 0%, transparent 50%), var(--surface-0)',
    }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Skeleton width={32} height={32} radius={8} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Skeleton width="50%" height={13} />
          <Skeleton width="25%" height={10} />
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="30%" height={10} />
        <Skeleton width="75%" height={20} />
        <Skeleton width="40%" height={10} />
        <Skeleton height={44} radius={10} style={{ marginTop: 8 }} />
      </div>
    </Glass>
  )
}

function ProgrammeHero({ program, activeWorkout, nextDay, nextWorkoutData, onStart, onContinue, onResume, onCancel, onPickDay, onProgramTap, loading }) {
  const { t } = useTranslation()

  const isPaused = activeWorkout?.pausedAt != null
  const isActive = !!activeWorkout

  const [elapsed, setElapsed] = useState(() =>
    isActive ? calcElapsed(activeWorkout.startedAt, activeWorkout.totalPausedMs, activeWorkout.pausedAt) : 0
  )

  useEffect(() => {
    if (!isActive || isPaused) return
    const interval = setInterval(() => {
      setElapsed(calcElapsed(activeWorkout.startedAt, activeWorkout.totalPausedMs, null))
    }, 1000)
    return () => clearInterval(interval)
  }, [isActive, isPaused, activeWorkout?.startedAt, activeWorkout?.totalPausedMs, activeWorkout?.pausedAt])

  const frozenElapsed = isActive && isPaused
    ? calcElapsed(activeWorkout.startedAt, activeWorkout.totalPausedMs, activeWorkout.pausedAt)
    : null
  const displayElapsed = frozenElapsed != null ? frozenElapsed : elapsed

  const mm = String(Math.floor(displayElapsed / 60)).padStart(2, '0')
  const ss = String(displayElapsed % 60).padStart(2, '0')

  const hasProgram = !!program
  const daysCount = program?.planJson?.days?.length || 0

  const activeDay = program && activeWorkout?.programDayIndex != null
    ? program.planJson?.days?.[activeWorkout.programDayIndex]
    : null
  const activeDayNum = activeWorkout?.programDayIndex != null
    ? activeWorkout.programDayIndex + 1
    : null

  return (
    <Glass padding={0} style={{
      marginBottom: 'var(--space-5)',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, hsla(var(--accent-h,158),40%,18%,0.55) 0%, transparent 50%), var(--surface-0)',
    }}>
      {/* Programme header */}
      {hasProgram && (
        <>
          <div
            onClick={onProgramTap}
            style={{
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'hsl(var(--accent-h,158),55%,72%)',
              flexShrink: 0,
            }}>
              <Icon name="list" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--fg-primary)',
              }}>
                {program.name}
              </div>
              {daysCount > 0 && (
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--fg-tertiary)',
                  marginTop: 1,
                }}>
                  {t('home.nDays', { n: daysCount })}
                </div>
              )}
            </div>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)' }} />
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </>
      )}

      {/* Hero section */}
      <div style={{ padding: hasProgram ? '14px 14px 16px' : '20px' }}>

        {/* ── Active / Paused state ── */}
        {isActive && (() => {
          const statusColor = isPaused ? 'var(--warning, hsl(45,80%,60%))' : 'hsl(140,55%,65%)'
          const statusColorLight = isPaused ? 'var(--warning, hsl(45,80%,60%))' : 'hsl(140,55%,72%)'
          const statusLabel = isPaused ? t('home.workoutPaused') : t('home.workoutActive')
          return (
            <>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusColor,
                    ...(!isPaused && {
                      boxShadow: '0 0 8px hsla(140,55%,55%,0.7)',
                      animation: 'trainerPulse 2s ease-in-out infinite',
                    }),
                  }} />
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: statusColorLight,
                  }}>
                    {statusLabel}
                  </span>
                </div>
                {activeDay && (
                  <div style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 600,
                    color: 'var(--fg-primary)',
                    lineHeight: 1.2,
                  }}>
                    {`День ${activeDayNum} · ${activeDay.title}`}
                  </div>
                )}
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--fg-tertiary)',
                  marginTop: 4,
                }}>
                  {getRelativeStart(activeWorkout.startedAt, t)}
                </div>
              </div>

              {/* Timer card */}
              <div style={{
                padding: '16px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: 'var(--tracking-caps)',
                  textTransform: 'uppercase',
                  color: 'var(--fg-tertiary)',
                  marginBottom: 8,
                }}>
                  {t('home.workoutDuration')}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 44,
                  fontWeight: 600,
                  color: isPaused ? 'var(--fg-secondary)' : 'var(--fg-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}>
                  {mm}:{ss}
                </div>
              </div>

              <Button
                variant="accent"
                size="lg"
                block
                icon="play"
                onClick={isPaused ? onResume : onContinue}
              >
                {t('home.continueWorkoutFull')}
              </Button>

              <button
                onClick={onCancel}
                style={{
                  marginTop: 'var(--space-3)',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-tertiary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                {t('home.cancelWorkout')}
              </button>

              <style>{`@keyframes trainerPulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
            </>
          )
        })()}

        {/* ── Default state ── */}
        {!isActive && (
          <>
            {nextDay && (() => {
              const exCount = nextDay.exercises?.length || 0
              const estimatedMin = Math.round(nextDay.exercises?.reduce((sum, ex) => {
                const sets = ex.sets || 3
                return sum + sets * 1.5 + (sets - 1) * (ex.restSec || 90) / 60
              }, 0) || 0)
              const dayNum = nextWorkoutData?.dayIndex != null ? nextWorkoutData.dayIndex + 1 : null

              return (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: 'hsl(var(--accent-h,158),55%,72%)',
                    marginBottom: 6,
                  }}>
                    {t('home.next')}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 600,
                    color: 'var(--fg-primary)',
                    lineHeight: 1.2,
                  }}>
                    {dayNum ? `День ${dayNum} · ${nextDay.title}` : nextDay.title}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--fg-tertiary)',
                    marginTop: 6,
                  }}>
                    <span>{t('home.nExercises', { n: exCount })}</span>
                    {estimatedMin > 0 && <span>{t('home.estimatedMin', { n: estimatedMin })}</span>}
                  </div>
                </div>
              )
            })()}
            <Button
              variant="accent"
              size="lg"
              block
              icon="play"
              loading={loading}
              onClick={() => onStart(nextWorkoutData?.programId, nextWorkoutData?.dayIndex)}
            >
              {t('home.startWorkout')}
            </Button>
            {nextDay && (
              <button
                onClick={onPickDay}
                style={{
                  marginTop: 'var(--space-3)',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-tertiary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                {t('home.startFreeform')}
              </button>
            )}
          </>
        )}
      </div>
    </Glass>
  )
}

// ─── Progress Components (from ProgressPage) ─────────────────────────

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
        <circle cx={cx} cy={cy} r={r}
          stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
        <circle cx={cx} cy={cy} r={r}
          stroke="hsla(140,55%,55%,0.25)" strokeWidth={5} fill="none"
          strokeDasharray={`${greenLen} ${circ}`}
          strokeDashoffset={`${-circ * (angOf(min) / 360)}`} />
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

function DotLadder({ actual, min, max }) {
  const effectiveMax = max || actual
  const maxDots = Math.min(Math.max(actual, effectiveMax), effectiveMax + 8)
  const overflowCount = actual > maxDots ? actual - maxDots : 0

  const elements = []
  for (let i = 1; i <= maxDots; i++) {
    if (min && i === min) {
      elements.push(
        <span key={`ml-${i}`} style={{
          width: 1, height: 12, background: 'rgba(255,255,255,0.3)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }

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

function WeeklyCard({ data }) {
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

function MuscleGroupCard({ group }) {
  const { t } = useTranslation()
  const iconName = MUSCLE_ICONS[group.group] || 'activity'
  const hasTarget = group.setsTarget != null && group.setsTarget > 0
  const min = getMin(group.setsTarget)
  const max = group.setsTarget

  return (
    <Glass style={{ padding: 'var(--space-4)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 'var(--space-3)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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

          {hasTarget && (
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
              marginBottom: 6,
            }}>
              {t('progress.muscle.target', { min, max })}
            </div>
          )}

          <StatusBadge actual={group.setsActual} target={group.setsTarget} t={t} />
        </div>

        <RingChart actual={group.setsActual} target={group.setsTarget} size={56} />
      </div>

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

// ─── Progress Skeleton ──────────────────────────────────────────────

function ProgressSectionSkeleton() {
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

// ─── Main Component ────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { yearStats, activeWorkout, program, nextWorkout, loaded, refresh, setData } = useHomeData()
  const { state: progressState, planAdherence, muscleVolume, records, loaded: progressLoaded, refresh: refreshProgress } = useProgressData()

  const [starting, setStarting] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { refreshProgress() }, [refreshProgress])

  const handleStart = async (programId, dayIndex) => {
    setStarting(true)
    try {
      const body = {}
      if (programId) {
        body.programId = programId
        body.programDayIndex = dayIndex
      }
      await apiPost('/api/v1/workouts', body)
      navigate('/workout')
    } catch (err) {
      console.error('Failed to start workout:', err)
      setStarting(false)
    }
  }

  const handleContinue = () => navigate('/workout')

  const handleResume = async () => {
    if (!activeWorkout?.pausedAt) return
    const pauseDuration = Date.now() - new Date(activeWorkout.pausedAt).getTime()
    setData(prev => ({
      ...prev,
      activeWorkout: {
        ...prev.activeWorkout,
        pausedAt: null,
        totalPausedMs: (prev.activeWorkout.totalPausedMs || 0) + pauseDuration,
      },
    }))
    try {
      await apiPatch(`/api/v1/workouts/${activeWorkout.id}`, { action: 'resume' })
    } catch { /* optimistic update already applied */ }
    navigate('/workout')
  }

  const handleCancel = async () => {
    if (!activeWorkout) return
    setConfirmCancel(false)
    setData(prev => ({ ...prev, activeWorkout: null }))
    try { await apiDelete(`/api/v1/workouts/${activeWorkout.id}`) } catch { /* ignore */ }
  }

  const handlePickDay = (dayIndex) => {
    const day = program.planJson.days[dayIndex]
    setData(prev => ({
      ...prev,
      nextWorkout: {
        programId: program.id,
        day,
        dayIndex,
        totalDays: program.planJson.days.length,
      },
    }))
    setShowDayPicker(false)
  }

  const handlePickFreeform = () => {
    setShowDayPicker(false)
    handleStart()
  }

  const showSkeletons = !loaded

  // Filter muscle groups with data or targets
  const visibleMuscles = (muscleVolume || []).filter(
    g => g.setsActual > 0 || (g.setsTarget != null && g.setsTarget > 0)
  )

  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
      <YearHeader
        done={yearStats?.done ?? 0}
        target={yearStats?.target ?? 208}
        loading={showSkeletons}
      />

      {showSkeletons ? (
        <ProgrammeHeroSkeleton />
      ) : (
        <ProgrammeHero
          program={program}
          activeWorkout={activeWorkout}
          nextDay={nextWorkout?.day}
          nextWorkoutData={nextWorkout}
          onStart={handleStart}
          onContinue={handleContinue}
          onResume={handleResume}
          onCancel={() => setConfirmCancel(true)}
          onPickDay={() => setShowDayPicker(true)}
          onProgramTap={() => program && navigate('/program/' + program.id)}
          loading={starting}
        />
      )}

      {/* Progress section */}
      {!progressLoaded ? (
        <ProgressSectionSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Weekly adherence */}
          {planAdherence && <WeeklyCard data={planAdherence} />}

          {/* Muscle volume */}
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
          {progressState === 'mostly_empty' && <MostlyEmptyHint />}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={t('workout.cancelWorkoutTitle')}
        message={t('workout.cancelWorkoutMessage')}
        confirmLabel={t('workout.cancelWorkoutConfirm')}
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      {/* Day picker bottom sheet */}
      <BottomSheet open={showDayPicker} onClose={() => setShowDayPicker(false)}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--fg-primary)',
            marginBottom: 4,
          }}>
            {t('home.pickDayTitle')}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--fg-tertiary)',
          }}>
            {t('home.pickDaySubtitle')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {program?.planJson?.days?.map((day, idx) => {
            const isPlanned = nextWorkout?.dayIndex === idx
            const exCount = day.exercises?.length || 0
            const muscles = day.exercises
              ?.map(ex => ex.muscleGroup)
              .filter((v, i, a) => v && a.indexOf(v) === i)
              .join(', ')

            return (
              <button
                key={idx}
                onClick={() => handlePickDay(idx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--surface-0, rgba(255,255,255,0.04))',
                  backdropFilter: 'blur(12px)',
                  border: isPlanned
                    ? '1.5px solid hsl(var(--accent-h,158),55%,55%)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="dumbbell" size={16} style={{ color: 'hsl(var(--accent-h,158),55%,72%)', flexShrink: 0 }} />
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--fg-primary)',
                    flex: 1,
                  }}>
                    {`День ${idx + 1} · ${day.title}`}
                  </span>
                  {isPlanned && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 'var(--tracking-caps)',
                      color: 'hsl(var(--accent-h,158),55%,72%)',
                      background: 'hsla(var(--accent-h,158),40%,30%,0.3)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                    }}>
                      {t('home.pickDayPlanned')}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--fg-tertiary)',
                  marginTop: 4,
                  marginLeft: 24,
                }}>
                  {muscles || t('home.nExercises', { n: exCount })}
                </div>
              </button>
            )
          })}

          {/* Freeform option */}
          <button
            onClick={handlePickFreeform}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '12px 14px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plus" size={16} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--fg-primary)',
              }}>
                {t('home.pickFreeform')}
              </span>
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--fg-tertiary)',
              marginTop: 4,
              marginLeft: 24,
            }}>
              {t('home.pickFreeformDesc')}
            </div>
          </button>
        </div>

        <button
          onClick={() => setShowDayPicker(false)}
          style={{
            marginTop: 'var(--space-4)',
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--fg-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          {t('confirm.cancel')}
        </button>
      </BottomSheet>
    </div>
  )
}
