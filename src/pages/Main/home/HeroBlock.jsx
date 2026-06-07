import { useState, useEffect } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Icon } from '../../../components/ui/Icon.jsx'
import { Skeleton } from '../../../components/ui/Skeleton.jsx'
import { WeekCalendar } from './WeekCalendar.jsx'

// ─── Timer helpers (ported from ProgrammeHero) ──────────────────────
function calcElapsed(startedAt, totalPausedMs, pausedAt) {
  const start = new Date(startedAt).getTime()
  const paused = totalPausedMs || 0
  if (pausedAt) {
    return Math.max(0, Math.floor((new Date(pausedAt).getTime() - start - paused) / 1000))
  }
  return Math.max(0, Math.floor((Date.now() - start - paused) / 1000))
}

// ─── Hero gradient background (spec: Home-Hero-styles.md §Фон) ─────
const HERO_BG = [
  'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 24%)',
  'radial-gradient(110% 75% at 82% 4%, rgba(110,240,200,0.30) 0%, transparent 52%)',
  'linear-gradient(164deg, #11A479 0%, #0B8160 50%, #075B43 100%)',
].join(', ')

const HERO_SHADOW = '0 16px 40px rgba(8,90,66,0.42)'

/**
 * HeroBlock — main hero section of the home screen (GD design).
 */
export function HeroBlock({
  user,
  streak,
  program,
  nextWorkout,
  activeWorkout,
  doneDates,
  onStart,
  onContinue,
  onResume,
  onCancel,
  onPickDay,
  loading,
}) {
  const { t } = useTranslation()

  const isPaused = activeWorkout?.pausedAt != null
  const isActive = !!activeWorkout

  // ── Live timer ──
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

  // ── Next day info ──
  const nextDay = nextWorkout?.day
  const dayNum = nextWorkout?.dayIndex != null ? nextWorkout.dayIndex + 1 : null
  const exCount = nextDay?.exercises?.length || 0
  const estimatedMin = Math.round(nextDay?.exercises?.reduce((sum, ex) => {
    const sets = ex.sets || 3
    return sum + sets * 1.5 + (sets - 1) * (ex.restSec || 90) / 60
  }, 0) || 0)

  // ── Active day info ──
  const activeDay = program && activeWorkout?.programDayIndex != null
    ? program.planJson?.days?.[activeWorkout.programDayIndex]
    : null
  const activeDayNum = activeWorkout?.programDayIndex != null
    ? activeWorkout.programDayIndex + 1
    : null

  // ── Avatar initials ──
  const initials = user?.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : '?'

  return (
    <div style={{
      background: HERO_BG,
      borderRadius: '0 0 30px 30px',
      boxShadow: HERO_SHADOW,
      padding: '16px 18px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grain texture overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        mixBlendMode: 'soft-light',
        opacity: 0.22,
        pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundSize: '150px 150px',
      }} />

      {/* Content layer above grain */}
      <div style={{ position: 'relative' }}>

        {/* ── Top row: avatar + streak + bell ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {/* Avatar */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: '#fff',
          }}>
            {initials}
          </div>

          <div style={{ flex: 1 }} />

          {/* Streak chip */}
          {streak > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              padding: '7px 13px',
            }}>
              <Icon name="flame" size={16} strokeWidth={2} style={{ color: '#FFD27A' }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#fff',
              }}>
                {t('home.streakDays', { n: streak })}
              </span>
            </div>
          )}

          {/* Bell button */}
          <button style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            position: 'relative',
          }}>
            <Icon name="bell" size={15} strokeWidth={2} />
            {/* Notification dot */}
            <span style={{
              position: 'absolute',
              top: 9,
              right: 10,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#FF5C7A',
              boxShadow: '0 0 0 2px #0A7E58',
            }} />
          </button>
        </div>

        {/* ── Week calendar ── */}
        <WeekCalendar doneDates={doneDates} />

        {/* ── Divider ── */}
        <div style={{
          height: 1,
          background: 'rgba(255,255,255,0.18)',
          marginTop: 18,
        }} />

        {/* ── Active workout state ── */}
        {isActive && (
          <div style={{ marginTop: 16 }}>
            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isPaused ? 'var(--gd-warn)' : 'var(--gd-success)',
                ...(!isPaused && {
                  boxShadow: '0 0 8px rgba(61,219,134,0.7)',
                  animation: 'trainerPulse 2s ease-in-out infinite',
                }),
              }} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: isPaused ? 'var(--gd-warn)' : 'var(--gd-success)',
              }}>
                {isPaused ? t('home.workoutPaused') : t('home.workoutActive')}
              </span>
            </div>

            {/* Active day title */}
            {activeDay && (
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
                marginBottom: 6,
              }}>
                {`День ${activeDayNum} · ${activeDay.title}`}
              </div>
            )}

            {/* Timer */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 36,
              fontWeight: 600,
              color: isPaused ? 'rgba(255,255,255,0.5)' : '#fff',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginBottom: 16,
            }}>
              {mm}:{ss}
            </div>

            {/* Continue button */}
            <button
              onClick={isPaused ? onResume : onContinue}
              style={{
                width: '100%',
                height: 54,
                borderRadius: 16,
                background: '#fff',
                border: 'none',
                fontSize: 15.5,
                fontWeight: 700,
                color: '#0C9268',
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              }}
            >
              <Icon name="play" size={16} strokeWidth={2.4} />
              {t('home.continueWorkoutFull')}
            </button>

            {/* Cancel link */}
            <button
              onClick={onCancel}
              style={{
                marginTop: 12,
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              {t('home.cancelWorkout')}
            </button>

            <style>{`@keyframes trainerPulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
          </div>
        )}

        {/* ── Default state (no active workout) ── */}
        {!isActive && (
          <div style={{ marginTop: 16 }}>
            {/* Program pill */}
            {program && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 999,
                padding: '5px 11px',
              }}>
                <Icon name="sparkles" size={11} strokeWidth={2} style={{ color: '#fff' }} />
                <span style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {program.name}
                </span>
              </div>
            )}

            {/* Eyebrow */}
            {nextDay && dayNum && (
              <div style={{
                marginTop: 13,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)',
              }}>
                {t('home.nextLabel', { n: dayNum })}
              </div>
            )}

            {/* Title */}
            {nextDay && (
              <div style={{
                marginTop: 7,
                fontSize: 28,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
              }}>
                {nextDay.title}
              </div>
            )}

            {/* Meta: exercises + time */}
            {nextDay && (
              <div style={{
                marginTop: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.82)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="dumbbell" size={15} strokeWidth={2} />
                  {t('home.nExercises', { n: exCount })}
                </span>
                {estimatedMin > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="clock" size={15} strokeWidth={2} />
                    {t('home.estimatedMin', { n: estimatedMin })}
                  </span>
                )}
              </div>
            )}

            {/* CTA button */}
            <button
              onClick={() => onStart(nextWorkout?.programId, nextWorkout?.dayIndex)}
              disabled={loading}
              style={{
                marginTop: 18,
                width: '100%',
                height: 54,
                borderRadius: 16,
                background: '#fff',
                border: 'none',
                fontSize: 15.5,
                fontWeight: 700,
                color: '#0C9268',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 8px 22px rgba(0,0,0,0.2)',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              }}
            >
              {loading ? (
                t('workout.starting')
              ) : (
                <>
                  <Icon name="play" size={16} strokeWidth={2.4} />
                  {t('home.startWorkoutCta')}
                </>
              )}
            </button>

            {/* Ghost link: pick another */}
            {nextDay && (
              <button
                onClick={onPickDay}
                style={{
                  marginTop: 12,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '6px 0',
                }}
              >
                {t('home.doAnother')}
              </button>
            )}
          </div>
        )}

      </div>{/* end content layer */}
    </div>
  )
}

export function HeroBlockSkeleton() {
  return (
    <div style={{
      background: HERO_BG,
      borderRadius: '0 0 30px 30px',
      boxShadow: HERO_SHADOW,
      padding: '16px 18px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Skeleton width={36} height={36} radius={12} />
        <div style={{ flex: 1 }} />
        <Skeleton width={90} height={32} radius={16} />
        <Skeleton width={36} height={36} radius={12} />
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 18 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Skeleton width={20} height={8} radius={4} />
            <Skeleton width={34} height={34} radius={17} />
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', marginTop: 18 }} />
      <div style={{ marginTop: 16 }}>
        <Skeleton width={120} height={24} radius={12} style={{ marginBottom: 13 }} />
        <Skeleton width="50%" height={10} style={{ marginBottom: 7 }} />
        <Skeleton width="80%" height={28} style={{ marginBottom: 11 }} />
        <Skeleton width="40%" height={14} style={{ marginBottom: 18 }} />
        <Skeleton height={54} radius={16} />
      </div>
    </div>
  )
}
