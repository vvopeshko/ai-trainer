import { useExerciseHistory } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { exerciseProgress } from '../../../utils/exerciseProgress.js'
import { kgToLbs } from '../../../utils/weightUnit.js'

export function ExerciseProgress({ exerciseId, plan, unit = 'kg', timed = false }) {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useExerciseHistory(exerciseId)
  const workouts = data?.workouts ?? []
  const progress = exerciseProgress(workouts, timed ? null : plan)
  const style = { margin: '0 12px 12px', fontSize: 11, color: 'var(--fg-secondary)', lineHeight: 1.5 }
  if (isPending) return <div style={style}>{t('exerciseProgress.loading')}</div>
  if (isError) return <div style={style}><button onClick={() => refetch()} style={{ color: 'inherit', background: 'none', border: 0, padding: 0 }}>{t('exerciseProgress.retry')}</button></div>
  if (!progress) return <div style={style}>{t('exerciseProgress.empty')}</div>
  const weight = kg => unit === 'lbs' ? kgToLbs(kg ?? 0) : (kg ?? 0)
  const unitLabel = t(unit === 'lbs' ? 'units.lbs' : 'units.kg')
  const status = timed ? 'changed' : progress.trend
  const colors = { up: 'var(--success)', plateau: 'var(--warning)', down: 'var(--warning)' }
  const sameLoad = progress.latestSets.every(s => (s.weightKg ?? 0) === (progress.latestSets[0].weightKg ?? 0))
  const figures = timed
    ? progress.latestSets.map(s => s.reps).join(' / ') + ` ${t('exerciseProgress.seconds')}`
    : sameLoad
      ? `${weight(progress.latestSets[0].weightKg)} ${unitLabel} · ${progress.latestSets.map(s => s.reps).join(' / ')} ${t('units.reps')}`
      : progress.latestSets.map(s => `${weight(s.weightKg)} ${unitLabel} × ${s.reps}`).join(' · ')
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
        <strong style={{ color: colors[status] ?? 'var(--fg-primary)', fontSize: 12 }}>
          {t(`exerciseProgress.status.${status}`)}
        </strong>
        <span>{t(`exerciseProgress.reason.${timed ? 'timed' : progress.reason}`, {
          n: progress.unchanged, days: progress.unchangedDays, delta: Math.abs(progress.delta ?? 0),
        })}</span>
      </div>
      <div style={{ color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>{figures}</div>
      {!timed && progress.goal && (
        <div>{t('exerciseProgress.goal', {
          n: progress.goal.set, from: progress.goal.from, to: progress.goal.to,
          weight: weight(progress.goal.weightKg), unit: unitLabel,
        })}</div>
      )}
      <details style={{ marginTop: 3 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--fg-tertiary)' }}>{t('exerciseProgress.history', { n: workouts.length })}</summary>
        {workouts.map(w => (
          <div key={w.id} style={{ display: 'flex', gap: 10, paddingTop: 5 }}>
            <time dateTime={w.startedAt} style={{ flexShrink: 0, color: 'var(--fg-tertiary)' }}>
              {new Date(w.startedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </time>
            <span>{w.sets.map(s => timed ? `${s.reps} ${t('exerciseProgress.seconds')}` : `${weight(s.weightKg)} ${unitLabel} × ${s.reps}`).join(' · ')}</span>
          </div>
        ))}
      </details>
    </div>
  )
}
