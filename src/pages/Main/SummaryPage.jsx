/**
 * Summary Page — экран "Готово!" после завершения тренировки (BRD §12.3).
 *
 * Показывает: зелёную галочку, "Готово!", 2×2 stat-tiles (подходы, время, упражнения, тоннаж),
 * мышечные группы как chips, CTA "К программе".
 *
 * Данные: location.state (мгновенно, после финиша тренировки) с фолбэком на
 * GET /workouts/:id через useWorkoutDetail — чтобы прямое открытие /summary/:id
 * (перезагрузка, диплинк) показывало реальные цифры, а не нули.
 */
import { useEffect, useMemo } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { MUSCLE_GROUP } from '../../utils/muscleMapping.js'
import { useWorkoutDetail } from '../../hooks/queries.js'

/** Считает сводку по данным GET /workouts/:id (workout.sets c include exercise). */
function summarizeWorkout(workout) {
  if (!workout) return null

  const sets = workout.sets ?? []
  const exerciseIds = new Set()
  const muscleSet = new Set()
  let tonnageKg = 0

  for (const s of sets) {
    exerciseIds.add(s.exerciseId)
    if (s.weightKg && s.reps) tonnageKg += s.weightKg * s.reps
    for (const m of s.exercise?.primaryMuscles ?? []) muscleSet.add(m)
  }

  // Чистое время: finished − started − суммарные паузы
  let elapsedSec = 0
  if (workout.startedAt) {
    const end = workout.finishedAt ? new Date(workout.finishedAt) : new Date()
    const ms = end - new Date(workout.startedAt) - (workout.totalPausedMs ?? 0)
    elapsedSec = Math.max(0, Math.floor(ms / 1000))
  }

  tonnageKg = Math.round(tonnageKg)

  return {
    totalSets: sets.length,
    totalExercises: exerciseIds.size,
    elapsedSec,
    tonnageKg: tonnageKg || null,
    muscles: [...muscleSet],
  }
}

export default function SummaryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation()
  const { id } = useParams()

  // location.state — приоритет (мгновенно после финиша); без него грузим воркаут
  const hasState = !!state
  const { data: detailData } = useWorkoutDetail(hasState ? null : id)
  const fetched = useMemo(
    () => summarizeWorkout(detailData?.workout),
    [detailData?.workout],
  )

  const totalSets = state?.totalSets ?? fetched?.totalSets ?? 0
  const totalExercises = state?.totalExercises ?? fetched?.totalExercises ?? 0
  const elapsedSec = state?.elapsedSec ?? fetched?.elapsedSec ?? 0
  const tonnageKg = state?.tonnageKg ?? fetched?.tonnageKg ?? null
  const muscles = state?.muscles ?? fetched?.muscles ?? []

  // Deduplicate muscles by group name for display
  const muscleGroups = [...new Set(muscles.map(m => MUSCLE_GROUP[m]).filter(Boolean))]

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}ч ${m}м`
    return `${m} мин`
  }

  // Haptic feedback при монтировании
  useEffect(() => {
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
  }, [])

  const statTileLabel = {
    fontSize: 'var(--text-2xs)',
    fontWeight: 'var(--weight-semi)',
    color: 'var(--fg-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-caps)',
    marginBottom: 'var(--space-1)',
  }

  const statTileValue = {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--fg-primary)',
  }

  return (
    <div style={{
      background: 'var(--bg-app)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(var(--space-6) + var(--safe-top, 0px)) var(--space-6) calc(var(--space-6) + var(--safe-bottom, 0px))',
    }}>
      {/* Green check circle */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'hsla(140, 55%, 40%, 0.2)',
        border: '2px solid hsla(140, 55%, 55%, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-5)',
      }}>
        <Icon name="check" size={40} style={{ color: 'hsl(140, 55%, 65%)' }} />
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--fg-primary)',
        margin: 0,
        marginBottom: 'var(--space-2)',
      }}>
        {t('summary.title')}
      </h1>

      {/* Subtitle */}
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--fg-secondary)',
        margin: 0,
        marginBottom: 'var(--space-6)',
        textAlign: 'center',
      }}>
        {t('summary.subtitle')}
      </p>

      {/* Stat tiles — 2×2 grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-3)',
        width: '100%',
        maxWidth: 360,
        marginBottom: muscleGroups.length > 0 ? 'var(--space-5)' : 'var(--space-8)',
      }}>
        <Glass padding="14px" style={{ textAlign: 'center' }}>
          <div style={statTileLabel}>{t('summary.sets')}</div>
          <div style={statTileValue}>{totalSets}</div>
        </Glass>

        <Glass padding="14px" style={{ textAlign: 'center' }}>
          <div style={statTileLabel}>{t('summary.time')}</div>
          <div style={statTileValue}>{formatTime(elapsedSec)}</div>
        </Glass>

        <Glass padding="14px" style={{ textAlign: 'center' }}>
          <div style={statTileLabel}>{t('summary.exercises')}</div>
          <div style={statTileValue}>{totalExercises}</div>
        </Glass>

        {tonnageKg !== null && (
          <Glass padding="14px" style={{ textAlign: 'center' }}>
            <div style={statTileLabel}>{t('summary.tonnage')}</div>
            <div style={statTileValue}>
              {tonnageKg >= 1000 ? `${(tonnageKg / 1000).toFixed(1)}т` : `${tonnageKg}кг`}
            </div>
          </Glass>
        )}
      </div>

      {/* Muscle group chips */}
      {muscleGroups.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
          marginBottom: 'var(--space-8)',
          maxWidth: 360,
        }}>
          {muscleGroups.map(g => (
            <span key={g} style={{
              padding: '4px 12px',
              borderRadius: 12,
              background: 'var(--surface-0)',
              color: 'var(--fg-secondary)',
              fontSize: 'var(--text-xs)',
            }}>
              {g}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <Button
        variant="accent"
        size="lg"
        block
        onClick={() => navigate('/', { replace: true })}
        style={{ maxWidth: 360 }}
      >
        {t('summary.backHome')}
      </Button>
    </div>
  )
}
