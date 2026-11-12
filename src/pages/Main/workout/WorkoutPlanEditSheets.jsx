import { useState } from 'react'
import { BottomSheet } from '../../../components/ui/BottomSheet.jsx'
import { Button } from '../../../components/ui/Button.jsx'
import { ProgramSuperset } from '../program/ProgramSuperset.jsx'
import { useTranslation } from '../../../i18n/useTranslation.js'

export function WorkoutPlanEditor({ exercise, exercises, counts, onClose, onChange }) {
  const { t } = useTranslation()
  return <BottomSheet open={!!exercise} onClose={onClose} trapFocus>
    {exercise && <>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>{exercise.nameRu}</h2>
      <ProgramSuperset inWorkout key={exercise.exerciseId} exercise={exercise} exercises={exercises} onChange={partnerId => onChange(partnerId ? { type: 'link', exerciseId: exercise.exerciseId, partnerId } : { type: 'unlink', exerciseId: exercise.exerciseId })} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
        <span style={{ flex: 1 }}>{t('workout.edit.setCount', { n: exercise.sets })}</span>
        <Button aria-label={t('workout.edit.fewerSets')} disabled={exercise.sets <= Math.max(1, counts[exercise.exerciseId] ?? 0)} onClick={() => onChange({ type: 'sets', counts: [{ exerciseId: exercise.exerciseId, sets: exercise.sets - 1 }] })}>−</Button>
        <Button aria-label={t('workout.addSetExtra')} disabled={exercise.sets >= 100} onClick={() => onChange({ type: 'sets', counts: [{ exerciseId: exercise.exerciseId, sets: exercise.sets + 1 }] })}>+</Button>
      </div>
      <Button block variant="danger" onClick={() => onChange({ type: 'remove', exerciseId: exercise.exerciseId })}>{t('workout.edit.remove')}</Button>
      <p style={{ color: 'var(--fg-secondary)', fontSize: 12, marginTop: 10 }}>{t('workout.edit.keepRecorded')}</p>
    </>}
  </BottomSheet>
}

export function WorkoutChangeScope({ pending, canUpdateProgram, details, busy, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const [scope, setScope] = useState(null)
  return <BottomSheet open={!!pending} onClose={() => { if (!busy) onCancel() }} trapFocus>
    <h2 style={{ fontSize: 18, fontWeight: 600 }}>{t('workout.edit.confirmTitle')}</h2>
    <p style={{ margin: '10px 0 16px', color: 'var(--fg-secondary)', fontSize: 14 }}>{pending ? t(`workout.edit.action.${pending.change.type}`) : ''}</p>
    {details && <p style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>{details}</p>}
    <div role="radiogroup" aria-label={t('workout.edit.scope')} style={{ display: 'grid', gap: 10 }}>
      {['workout', 'program'].map(value => <button key={value} role="radio" aria-checked={scope === value} disabled={busy || (value === 'program' && !canUpdateProgram)} onClick={() => setScope(value)} style={{ textAlign: 'left', padding: 14, minHeight: 64, borderRadius: 12, border: `1px solid ${scope === value ? 'var(--accent-color)' : 'var(--stroke-0)'}`, background: scope === value ? 'var(--accent-color-soft)' : 'var(--surface-0)', color: 'var(--fg-primary)', opacity: value === 'program' && !canUpdateProgram ? 0.4 : 1 }}>
        <strong>{t(`workout.edit.scope.${value}`)}</strong>
        <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 4 }}>{t(`workout.edit.scope.${value}Hint`)}</div>
      </button>)}
    </div>
    {!canUpdateProgram && <p style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 10 }}>{t('workout.edit.noProgramSlot')}</p>}
    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
      <Button block variant="ghost" disabled={busy} onClick={onCancel}>{t('confirm.cancel')}</Button>
      <Button block disabled={!scope} loading={busy} onClick={() => onConfirm(scope)}>{t('workout.edit.apply')}</Button>
    </div>
  </BottomSheet>
}
