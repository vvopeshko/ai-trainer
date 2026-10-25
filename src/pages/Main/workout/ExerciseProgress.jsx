import { useState } from 'react'
import { useExerciseHistory } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { exerciseProgress } from '../../../utils/exerciseProgress.js'
import { ExerciseTrendChart } from './ExerciseTrendChart.jsx'
import { kgToLbs, stepWeight } from '../../../utils/weightUnit.js'

export function ExerciseProgress({ exerciseId, plan, unit = 'kg', step, stepUnit, timed = false }) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState(null)
  const { data, isPending, isError, refetch } = useExerciseHistory(exerciseId)
  const workouts = data?.workouts ?? []
  const progress = exerciseProgress(workouts, timed ? null : plan)
  const style = { margin: '0 12px 12px', fontSize: 11, color: 'var(--fg-secondary)', lineHeight: 1.5 }
  if (isPending) return <div style={style}>{t('exerciseProgress.loading')}</div>
  if (isError) return <div style={style}><button onClick={() => refetch()} style={{ color: 'inherit', background: 'none', border: 0, padding: 0 }}>{t('exerciseProgress.retry')}</button></div>
  if (!progress) return <div style={style}>{t('exerciseProgress.empty')}</div>
  const weight = kg => unit === 'lbs' ? kgToLbs(kg ?? 0) : (kg ?? 0)
  const unitLabel = t(unit === 'lbs' ? 'units.lbs' : 'units.kg')
  const colors = { up: 'var(--success)', plateau: 'var(--warning)', down: 'var(--warning)' }
  const evidence = progress.evidence
  const volume = progress.volume
  const last = volume.latest
  const number = value => Math.round(value).toLocaleString('ru-RU')
  const amount = value => number(volume.metric === 'tonnage' && unit === 'lbs' ? value / 0.45359237 : value)
  const volumeUnit = volume.metric === 'tonnage' ? unitLabel : t('units.reps')
  const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`
  const date = time => new Date(time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  const { records, ready } = progress
  const recordSets = sets => sets.map(s => s.weightKg > 0 ? `${weight(s.weightKg)} ${unitLabel} × ${s.reps}` : `${s.reps} ${t('units.reps')}`).join(', ')
  return (
    <div style={style}>
      {timed && <div>{progress.latestSets.map(s => s.reps).join(' / ')} {t('exerciseProgress.seconds')}</div>}
      {!timed && <>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <strong style={{ color: colors[progress.trend] ?? 'var(--fg-primary)', fontSize: 12 }}>{t(`exerciseProgress.status.${progress.trend}`)}</strong>
          <span>{progress.trend === 'plateau' ? t('exerciseProgress.noGrowthDays', { days: progress.plateauDays }) : t('exerciseProgress.period', { n: progress.count, days: progress.days })}</span>
        </div>
        {evidence && progress.trend !== 'mixed' && <div style={{ color: 'var(--fg-primary)' }}>{evidence.kind === 'weight'
          ? t('exerciseProgress.weightEvidence', { reps: evidence.anchor, from: weight(evidence.from), to: weight(evidence.to), unit: unitLabel })
          : `${weight(evidence.anchor)} ${unitLabel}: ${evidence.from} → ${evidence.to} ${t('units.reps')}`}</div>}
        {records.last && <div>{records.latest.length
          ? <strong style={{ color: 'var(--success)' }}>{t('exerciseProgress.recordNew', { sets: recordSets(records.latest) })}</strong>
          : t('exerciseProgress.record', { sets: recordSets(records.last.records), date: date(records.last.time), n: records.since })}</div>}
        <div>{t(`exerciseProgress.volume.${volume.status}`)}</div>
        <div>{!last ? t('exerciseProgress.noPrevious')
          : last.setDelta !== 0 ? t('exerciseProgress.setChange', { delta: signed(last.setDelta) })
            : last.percent != null ? t('exerciseProgress.lastVolume', { percent: signed(last.percent) })
              : t('exerciseProgress.lastReps', { delta: signed(last.repDelta) })}</div>
        {ready && <div style={{ color: 'var(--success)' }}>{ready.weightKg > 0 && step
          ? t('exerciseProgress.ready', { reps: ready.reps, weight: stepWeight(weight(ready.weightKg), 1, step, stepUnit ?? unit, unit), unit: unitLabel })
          : t('exerciseProgress.readyHarder', { reps: ready.reps })}
          {ready.sessions > 1 && ` · ${t('exerciseProgress.readySessions', { n: ready.sessions })}`}</div>}
        {progress.goal && <div>{t('exerciseProgress.goal', {
          n: progress.goal.set, from: progress.goal.from, to: progress.goal.to,
          weight: weight(progress.goal.weightKg), unit: unitLabel,
        })}</div>}
      </>}
      <details style={{ marginTop: 3 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--fg-tertiary)' }}>{t('exerciseProgress.history', { n: workouts.length })}</summary>
        {!timed && <>
          {progress.charts.map(chart => <ExerciseTrendChart key={`${chart.kind}-${chart.anchor}`} chart={chart} unit={unit} />)}
          {!progress.charts.length && <p>{t('exerciseProgress.chartInsufficient')}</p>}
          <details style={{ margin: '6px 0' }}>
            <summary style={{ cursor: 'pointer' }}>{t('exerciseProgress.how')}</summary>
            {volume.size && <>
              <p>{t(volume.metric === 'tonnage' ? 'exerciseProgress.volumeDefinition' : 'exerciseProgress.repsDefinition')}</p>
              <div>{date(volume.fromPeriod[0])}–{date(volume.fromPeriod[1])}: {amount(volume.from)} {volumeUnit}</div>
              <div>{date(volume.toPeriod[0])}–{date(volume.toPeriod[1])}: {amount(volume.to)} {volumeUnit}</div>
              <div>{t('exerciseProgress.volumeSamples', { n: volume.size, percent: signed(volume.percent) })}</div>
            </>}
            {last?.from != null && <p>{t('exerciseProgress.lastNumbers', { from: amount(last.from), to: amount(last.to), unit: volumeUnit })}</p>}
            <p>{t('exerciseProgress.method')}</p>
          </details>
          {data.hasMore && <p>{t('exerciseProgress.limited')}</p>}
        </>}
        {workouts.slice(0, expandedId === exerciseId ? workouts.length : 8).map(w => (
          <div key={w.id} style={{ display: 'flex', gap: 10, paddingTop: 5 }}>
            <time dateTime={w.startedAt} style={{ flexShrink: 0, color: 'var(--fg-tertiary)' }}>
              {new Date(w.startedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </time>
            <span>{w.sets.map(s => timed ? `${s.reps} ${t('exerciseProgress.seconds')}` : `${weight(s.weightKg)} ${unitLabel} × ${s.reps}`).join(' · ')}</span>
          </div>
        ))}
        {workouts.length > 8 && <button onClick={() => setExpandedId(expandedId === exerciseId ? null : exerciseId)} style={{ background: 'none', border: 0, padding: '6px 0', color: 'inherit' }}>{t(expandedId === exerciseId ? 'exerciseProgress.less' : 'exerciseProgress.more')}</button>}
      </details>
    </div>
  )
}
