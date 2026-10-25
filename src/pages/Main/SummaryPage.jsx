/**
 * Summary Page — экран "Готово!" после завершения тренировки (BRD §12.3).
 *
 * Показывает: зелёную галочку, "Готово!", 2×2 stat-tiles (подходы, время, упражнения, тоннаж),
 * мышечные группы как chips, CTA "К программе".
 *
 * Данные: серверный ответ завершения в query cache или GET /workouts/:id.
 */
import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { MuscleTile } from '../../components/ui/MuscleTile.jsx'
import { MUSCLE_GROUP } from '../../utils/muscleMapping.js'
import { summarizeWorkout } from '../../utils/workoutSummary.js'
import { useWorkoutDetail } from '../../hooks/queries.js'

export default function SummaryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()

  // Finish seeds this query with the server response. Reloads fetch the same data.
  const { data: detailData, isPending, isError, refetch } = useWorkoutDetail(id)
  const fetched = useMemo(
    () => summarizeWorkout(detailData?.workout),
    [detailData?.workout],
  )

  const totalSets = fetched?.totalSets ?? 0
  const totalExercises = fetched?.totalExercises ?? 0
  const elapsedSec = fetched?.elapsedSec ?? 0
  const tonnageKg = fetched?.tonnageKg ?? null
  const muscles = fetched?.muscles ?? []

  // Deduplicate muscles by group name for display
  const muscleGroups = [...new Set(muscles.map(m => MUSCLE_GROUP[m]).filter(Boolean))]

  const formatTime = (sec) => {
    if (sec < 60) return t('summary.timeSec', { s: sec })
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return t('summary.timeHm', { h, hUnit: t('units.hoursShort'), m, mUnit: t('units.minsShort') })
    return t('summary.timeMin', { m })
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

  if (isPending || isError || !fetched) return (
    <div style={{ padding: 24, color: 'var(--fg-primary)' }}>
      <p>{t(isPending ? 'common.loading' : 'errors.network')}</p>
      {!isPending && <Button onClick={() => refetch()}>{t('common.retry')}</Button>}
    </div>
  )

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
              {tonnageKg >= 1000 ? `${(tonnageKg / 1000).toFixed(1)}${t('units.tonnes')}` : `${tonnageKg}${t('units.kg')}`}
            </div>
          </Glass>
        )}
      </div>

      {/* Muscle group chips */}
      {muscleGroups.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
          width: '100%',
          marginBottom: 'var(--space-8)',
          maxWidth: 360,
        }}>
          {muscleGroups.map(g => (
            <MuscleTile key={g} muscle={g}>{g}</MuscleTile>
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
