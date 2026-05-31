import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Button } from '../../../components/ui/Button.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'
import { BodyMap } from '../../../components/ui/BodyMap.jsx'

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

export function ProgrammeHeroSkeleton() {
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

export function ProgrammeHero({ program, activeWorkout, nextDay, nextWorkoutData, onStart, onContinue, onResume, onCancel, onPickDay, onProgramTap, loading }) {
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

  // Extract muscles from active day for mini BodyMap
  const activeDayMuscles = useMemo(() => {
    if (!activeDay?.exercises) return []
    const vol = {}
    for (const ex of activeDay.exercises) {
      for (const m of ex.primaryMuscles || []) {
        vol[m] = (vol[m] || 0) + (ex.sets || 3)
      }
    }
    return Object.entries(vol).map(([muscle, setsActual]) => ({ muscle, setsActual }))
  }, [activeDay])

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

              {activeDayMuscles.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <BodyMap muscles={activeDayMuscles} height={160} />
                </div>
              )}

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
