import { useState } from 'react'
import { useExerciseHistory } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { exerciseProgress } from '../../../utils/exerciseProgress.js'
import { kgToLbs } from '../../../utils/weightUnit.js'

export function ExerciseProgress({ exerciseId, plan, unit = 'kg', timed = false }) {
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
  const band = progress.band
  const evidence = progress.evidence
  const volume = progress.volume
  const last = volume.latest
  const number = value => Math.round(value).toLocaleString('ru-RU')
  const amount = value => number(volume.metric === 'tonnage' && unit === 'lbs' ? value / 0.45359237 : value)
  const volumeUnit = volume.metric === 'tonnage' ? unitLabel : t('units.reps')
  const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`
  const points = progress.points
  const min = Math.min(...points.map(p => p.value)), max = Math.max(...points.map(p => p.value))
  const x = p => 8 + 284 * (p.time - points[0].time) / Math.max(1, points.at(-1).time - points[0].time)
  const y = p => max === min ? 30 : 52 - 44 * (p.value - min) / (max - min)
  const date = time => new Date(time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  return (
    <div style={style}>
      {timed && <div>{progress.latestSets.map(s => s.reps).join(' / ')} {t('exerciseProgress.seconds')}</div>}
      {!timed && <>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <strong style={{ color: colors[progress.trend] ?? 'var(--fg-primary)', fontSize: 12 }}>{t(`exerciseProgress.status.${progress.trend}`)}</strong>
          <span>{t('exerciseProgress.period', { n: progress.trend === 'plateau' ? progress.plateauCount : progress.count, days: progress.trend === 'plateau' ? progress.plateauDays : progress.days })}</span>
        </div>
        {evidence && progress.trend !== 'mixed' && <div style={{ color: 'var(--fg-primary)' }}>{evidence.kind === 'weight'
          ? `${weight(evidence.from)} → ${weight(evidence.to)} ${unitLabel} × ${evidence.anchor}`
          : `${weight(evidence.anchor)} ${unitLabel}: ${evidence.from} → ${evidence.to} ${t('units.reps')}`}</div>}
        <div>{t(`exerciseProgress.volume.${volume.status}`)}{volume.from != null && ` · ${amount(volume.from)} → ${amount(volume.to)} ${volumeUnit}`}</div>
        <div>{t('exerciseProgress.last')}: {!last ? t('exerciseProgress.noPrevious')
          : last.setDelta !== 0 ? t('exerciseProgress.setChange', { delta: signed(last.setDelta) })
            : last.delta != null ? `${signed(volume.metric === 'tonnage' && unit === 'lbs' ? last.delta / 0.45359237 : last.delta)} ${volumeUnit}${last.percent != null ? ` (${signed(last.percent)}%)` : ''}`
              : `${signed(last.repDelta)} ${t('units.reps')}`}</div>
        {progress.goal && <div>{t('exerciseProgress.goal', {
          n: progress.goal.set, from: progress.goal.from, to: progress.goal.to,
          weight: weight(progress.goal.weightKg), unit: unitLabel,
        })}</div>}
      </>}
      <details style={{ marginTop: 3 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--fg-tertiary)' }}>{t('exerciseProgress.history', { n: workouts.length })}</summary>
        {!timed && <>
          <div style={{ marginTop: 6 }}>{t('exerciseProgress.comparisonNote')}</div>
          {volume.size && <div>{t('exerciseProgress.volumeWindow', { n: volume.size })}</div>}
          {band?.days > 0 && band.high > 0 && <div>{t('exerciseProgress.band', { weight: band.low === band.high ? weight(band.low) : `${weight(band.low)}–${weight(band.high)}`, unit: unitLabel, days: band.days })}</div>}
          {points.length > 1 && max > 0 && <figure style={{ margin: '8px 0' }}>
            <figcaption>{t('exerciseProgress.chart')} · {weight(min)}{min !== max ? `–${weight(max)}` : ''} {unitLabel}</figcaption>
            <svg viewBox="0 0 300 60" role="img" aria-label={t('exerciseProgress.chart')} style={{ width: '100%', height: 60, display: 'block' }}>
              <polyline points={points.map(p => `${x(p)},${y(p)}`).join(' ')} fill="none" stroke="var(--fg-secondary)" strokeWidth="1.5" />
              {points.map(p => <circle key={p.time} cx={x(p)} cy={y(p)} r="2.5" fill="var(--accent, #54d9ae)"><title>{date(p.time)} · {weight(p.value)} {unitLabel}</title></circle>)}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{date(points[0].time)}</span><span>{date(points.at(-1).time)}</span></div>
          </figure>}
          <details style={{ margin: '6px 0' }}><summary style={{ cursor: 'pointer' }}>{t('exerciseProgress.how')}</summary><p>{t('exerciseProgress.method')}</p></details>
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
