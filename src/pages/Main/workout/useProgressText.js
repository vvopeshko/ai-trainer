import { useTranslation } from '../../../i18n/useTranslation.js'
import { kgToLbs, stepWeight } from '../../../utils/weightUnit.js'

// Shared text for the compact card and the sheet: status reason, today's
// action and the latest session. Unit conversion happens only here.
export function useProgressText(progress, { plan, unit, step, stepUnit }) {
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
  } else if (trend === 'first') {
    reason = progress.afterBreak ? t('exerciseProgress.afterBreak', { n: progress.count })
      : t('exerciseProgress.needMore', { n: 3 - progress.count })
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
