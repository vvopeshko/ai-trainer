import { useState } from 'react'
import { useExerciseHistory } from '../../../hooks/queries.js'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { exerciseProgress } from '../../../utils/exerciseProgress.js'
import { kgToLbs, stepWeight } from '../../../utils/weightUnit.js'
import { Icon } from '../../../components/ui/index.js'
import { ExerciseProgressSheet } from './ExerciseProgressSheet.jsx'
import { StatusPill, Sparkline } from './ProgressStatus.jsx'

// Shared text for the compact card and the sheet: status reason, today's
// action and the latest session. Unit conversion happens only here.
function useProgressText(progress, { plan, unit, step, stepUnit }) {
  const { t } = useTranslation()
  const unitLabel = t(unit === 'lbs' ? 'units.lbs' : 'units.kg')
  const weight = kg => unit === 'lbs' ? kgToLbs(kg ?? 0) : (kg ?? 0)
  const span = days => days < 14 ? t('exerciseProgress.spanDays', { n: days })
    : days < 60 ? t('exerciseProgress.spanWeeks', { n: Math.round(days / 7) })
      : t('exerciseProgress.spanMonths', { n: Math.round(days / 30) })
  const date = time => new Date(time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  const set = s => (s.weightKg ?? 0) > 0 ? `${weight(s.weightKg)}×${s.reps}` : `${s.reps} ${t('units.reps')}`
  if (!progress) return { unitLabel, weight, span, date, set }
  const { trend, evidence, band, records, ready, goal, stall, plateau } = progress
  const period = t('exerciseProgress.period', { n: progress.count, span: span(progress.days) })
  const stalled = t('exerciseProgress.noImprovement', { n: stall.sessions })
  let reason = period
  if (trend === 'plateau') {
    const range = band && band.high > 0
      ? band.low === band.high ? `${weight(band.low)} ${unitLabel}` : `${weight(band.low)}–${weight(band.high)} ${unitLabel}`
      : null
    reason = [stalled, range ? t('exerciseProgress.onRange', { range }) : span(stall.days)].join(' · ')
  } else if (evidence) {
    reason = evidence.kind === 'weight'
      ? t('exerciseProgress.weightEvidence', { reps: evidence.anchor, from: weight(evidence.from), to: weight(evidence.to), unit: unitLabel })
      : t('exerciseProgress.repsEvidence', { weight: weight(evidence.anchor), unit: unitLabel, from: evidence.from, to: evidence.to })
  } else if (trend === 'up' && records.lastImproved) {
    reason = t('exerciseProgress.recordReason', { sets: records.lastImproved.records.map(set).join(', '), date: date(records.lastImproved.time) })
  } else if (trend === 'steady') {
    reason = stall.rare ? t('exerciseProgress.rare') : stall.sessions > 0 ? stalled : period
  }
  // Today's single action: the next weight step, then the plateau fix, then +1 rep.
  let action = null
  if (ready) {
    action = ready.weightKg > 0 && step
      ? t('exerciseProgress.ready', { reps: ready.reps, weight: stepWeight(weight(ready.weightKg), 1, step, stepUnit ?? unit, unit), unit: unitLabel })
      : t('exerciseProgress.readyHarder', { reps: ready.reps })
    if (ready.sessions > 1) action += ` · ${t('exerciseProgress.readySessions', { n: ready.sessions })}`
  } else if (plateau?.kind === 'consolidate') {
    action = t('exerciseProgress.consolidate', { weight: weight(plateau.weightKg), unit: unitLabel })
    if (plan?.repsMin) action += ` · ${t('exerciseProgress.fromReps', { n: plan.repsMin })}`
  } else if (plateau?.kind === 'stuck') {
    action = plateau.weightKg > 0
      ? t('exerciseProgress.stuck', { weight: weight(plateau.weightKg), unit: unitLabel })
      : t('exerciseProgress.stuckBodyweight')
  } else if (goal) {
    action = t('exerciseProgress.goal', { n: goal.set, from: goal.from, to: goal.to, weight: weight(goal.weightKg), unit: unitLabel })
  }
  const lastSession = records.sessions.at(-1)
  return { unitLabel, weight, span, date, set, period, reason, action, lastSession }
}

export function ExerciseProgress({ exerciseId, plan, unit = 'kg', step, stepUnit, timed = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data, isPending, isError, refetch } = useExerciseHistory(exerciseId)
  const workouts = data?.workouts ?? []
  const progress = exerciseProgress(workouts, timed ? null : plan, { experienceLevel: data?.experienceLevel })
  const text = useProgressText(progress, { plan, unit, step, stepUnit })
  const style = { margin: '0 12px 12px', fontSize: 11.5, color: 'var(--fg-secondary)', lineHeight: 1.45 }
  if (isPending) return <div style={style}>{t('exerciseProgress.loading')}</div>
  if (isError) return <div style={style}><button onClick={() => refetch()} style={{ color: 'inherit', background: 'none', border: 0, padding: 0 }}>{t('exerciseProgress.retry')}</button></div>
  if (!progress) return <div style={style}>{t('exerciseProgress.empty')}</div>
  const last = text.lastSession
  const lastSets = timed
    ? `${last.sets.map(s => s.reps).join(' / ')} ${t('exerciseProgress.seconds')}`
    : last.sets.map(text.set).join(' · ')
  return <>
    <button onClick={() => setOpen(true)} aria-label={t('exerciseProgress.open')} style={{
      ...style, display: 'block', width: 'calc(100% - 24px)', textAlign: 'left', cursor: 'pointer',
      padding: '9px 11px', borderRadius: 12, border: '1px solid rgba(236,234,239,0.08)', background: 'rgba(236,234,239,0.03)',
    }}>
      {!timed && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusPill trend={progress.trend} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text.reason}</span>
        <Sparkline chart={progress.charts[0]} trend={progress.trend} />
      </div>}
      {!timed && text.action && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 7, fontSize: 13, color: 'var(--fg-primary)' }}>
        <Icon name="target" size={15} style={{ flexShrink: 0, marginTop: 1, color: progress.ready ? 'var(--success)' : progress.plateau ? 'var(--warning)' : 'var(--accent-color)' }} />
        <span>{text.action}</span>
      </div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: timed ? 0 : 7, color: 'var(--fg-tertiary)' }}>
        {!timed && progress.records.latest.length > 0 && <Icon name="trophy" size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0 }}>{t('exerciseProgress.lastTime', { date: text.date(last.time), sets: lastSets })}</span>
        <Icon name="chevronRight" size={14} style={{ flexShrink: 0 }} />
      </div>
    </button>
    <ExerciseProgressSheet open={open} onClose={() => setOpen(false)} exerciseId={exerciseId}
      progress={progress} data={data} text={text} unit={unit} timed={timed} />
  </>
}
