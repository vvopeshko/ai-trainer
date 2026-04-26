/**
 * Home Page — главный экран мини-аппа (BRD §12.1).
 *
 * Секции: YearHeader → ProgrammeHero → Month stats → Recent workouts.
 * Данные кэшируются в HomeDataContext (stale-while-revalidate).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { apiPost, apiPatch } from '../../utils/api.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { StatTile } from '../../components/ui/StatTile.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'

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
    // Frozen at pause moment
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
      {/* Programme header skeleton */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Skeleton width={32} height={32} radius={8} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Skeleton width="50%" height={13} />
          <Skeleton width="25%" height={10} />
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* Hero section skeleton */}
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="30%" height={10} />
        <Skeleton width="75%" height={20} />
        <Skeleton width="40%" height={10} />
        <Skeleton height={44} radius={10} style={{ marginTop: 8 }} />
      </div>
    </Glass>
  )
}

function ProgrammeHero({ program, activeWorkout, nextDay, nextWorkoutData, onStart, onContinue, onResume, onCancel, loading }) {
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

  // Active day info from programme
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
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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

        {/* ── Active / Paused state (unified layout) ── */}
        {isActive && (() => {
          const statusColor = isPaused ? 'var(--warning, hsl(45,80%,60%))' : 'hsl(140,55%,65%)'
          const statusColorLight = isPaused ? 'var(--warning, hsl(45,80%,60%))' : 'hsl(140,55%,72%)'
          const statusLabel = isPaused ? t('home.workoutPaused') : t('home.workoutActive')
          return (
            <>
              {/* Status + day info */}
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

              {/* Continue button */}
              <Button
                variant="accent"
                size="lg"
                block
                icon="play"
                onClick={isPaused ? onResume : onContinue}
              >
                {t('home.continueWorkoutFull')}
              </Button>

              {/* Cancel link */}
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
                onClick={() => onStart()}
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

// ─── Month Stats Skeleton ─────────────────────────────────────────────

function MonthStatsSkeleton() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 'var(--space-3)',
    }}>
      {[0, 1, 2, 3].map(i => (
        <Glass key={i} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width={20} height={20} radius={6} />
          <Skeleton width="40%" height={18} />
          <Skeleton width="60%" height={10} />
        </Glass>
      ))}
    </div>
  )
}

// ─── Recent Workouts List ──────────────────────────────────────────────

function RecentListSkeleton() {
  return (
    <div style={{ marginTop: 'var(--space-5)' }}>
      <Skeleton width="25%" height={13} style={{ marginBottom: 'var(--space-3)' }} />
      <Glass padding={0}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              padding: '12px 14px',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Skeleton width="70%" height={13} />
              <Skeleton width="30%" height={10} />
            </div>
            <Skeleton width={50} height={10} />
          </div>
        ))}
      </Glass>
    </div>
  )
}

function RecentList({ workouts }) {
  const { t } = useTranslation()

  if (!workouts || workouts.length === 0) return null

  return (
    <div style={{ marginTop: 'var(--space-5)' }}>
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        {t('home.recent')}
      </div>
      <Glass padding={0}>
        {workouts.map((w, i) => (
          <div
            key={w.id}
            style={{
              padding: '12px 14px',
              borderBottom: i < workouts.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--fg-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {w.exercises.join(', ')}
              </div>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--fg-tertiary)',
                marginTop: 2,
              }}>
                {t('home.sets', { n: w.setsCount })}
              </div>
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--fg-tertiary)',
              whiteSpace: 'nowrap',
            }}>
              {relativeDate(w.finishedAt, t)}
            </div>
          </div>
        ))}
      </Glass>
    </div>
  )
}

function relativeDate(dateStr, t) {
  const date = new Date(dateStr)
  const now = new Date()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((todayStart - dateStart) / 86400000)

  if (diffDays === 0) return t('home.today')
  if (diffDays === 1) return t('home.yesterday')
  return t('home.daysAgo', { n: diffDays })
}

// ─── Main Component ────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { yearStats, monthStats, recent, activeWorkout, program, nextWorkout, loaded, refresh, setData } = useHomeData()

  const [starting, setStarting] = useState(false)

  // Stale-while-revalidate: показываем кэш сразу, обновляем в фоне
  useEffect(() => { refresh() }, [refresh])

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
    try {
      await apiPatch(`/api/v1/workouts/${activeWorkout.id}`, { action: 'finish' })
    } catch { /* ignore */ }
    setData(prev => ({ ...prev, activeWorkout: null }))
  }

  const showSkeletons = !loaded

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
          onCancel={handleCancel}
          loading={starting}
        />
      )}

      {/* Month stats */}
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--fg-secondary)',
        marginBottom: 'var(--space-3)',
      }}>
        {t('home.thisMonth')}
      </div>
      {showSkeletons ? (
        <MonthStatsSkeleton />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-3)',
        }}>
          <StatTile label={t('home.workouts')} value={monthStats?.workouts ?? 0} icon="calendar" />
          <StatTile
            label={t('home.tonnage')}
            value={monthStats?.tonnageKg >= 1000 ? `${(monthStats.tonnageKg / 1000).toFixed(1)}т` : `${monthStats?.tonnageKg ?? 0}кг`}
            icon="trendingUp"
          />
          <StatTile label={t('home.streak')} value={monthStats?.streak ?? 0} icon="flame" />
          <StatTile label={t('home.records')} value="—" icon="trophy" />
        </div>
      )}

      {showSkeletons ? (
        <RecentListSkeleton />
      ) : (
        <RecentList workouts={recent} />
      )}
    </div>
  )
}
