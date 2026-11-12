import { useState } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { BottomSheet } from '../../../components/ui/BottomSheet.jsx'
import { SwipeRow } from '../../../components/ui/SwipeRow.jsx'
import { DoneSetRow } from './DoneSetRow.jsx'
import { supersetRows } from '../../../utils/supersets.js'
import { getSetSuggestion } from '../../../utils/setSuggestion.js'
import { getExerciseSettings, kgToLbs } from '../../../utils/weightUnit.js'

export function SupersetSets({ pair, currentId, setsById, lastResults, resting, renderActive, onDelete, onRemovePlanned, onAdd, onContinue, disabled }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const counts = Object.fromEntries(pair.map(ex => [ex.exerciseId, setsById[ex.exerciseId]?.length ?? 0]))
  const rows = supersetRows(pair, counts)
  return <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
    {rows.map(({ exercise, side, setIndex }) => {
      const id = exercise.exerciseId
      const set = setsById[id]?.[setIndex]
      const active = currentId === id && !resting && setIndex === counts[id]
      const restHere = currentId === id && resting && setIndex === counts[id] - 1
      const suggestion = getSetSuggestion({ setIndex, lastSets: lastResults[id]?.lastSets, doneSets: setsById[id] ?? [], plannedReps: exercise.repsMin })
      const unit = getExerciseSettings(exercise.slug).unit
      const weight = unit === 'lbs' ? kgToLbs(suggestion.weightKg) : suggestion.weightKg
      const label = <span style={{ width: 14, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent-color)' }}>{side ? 'B' : 'A'}</span>
      return <div key={`${id}:${setIndex}`}>
        {active ? <>
          <div style={{ display: 'flex', gap: 8, padding: '8px 0', fontSize: 12 }}>{label}<span>{exercise.nameRu}</span></div>
          {renderActive()}
          <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 8 }}>
            {side === 0 && counts[pair[1].exerciseId] < pair[1].sets
              ? t('superset.next', { name: pair[1].nameRu })
              : t('superset.rest', { seconds: pair[1].restSec ?? 90 })}
          </div>
        </> : set ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{label}<div style={{ flex: 1, minWidth: 0 }}>
          <DoneSetRow index={setIndex} weight={set.weightKg ?? 0} reps={set.reps} onDelete={disabled ? undefined : () => onDelete(id, setIndex)} />
        </div></div> : <SwipeRow onDelete={disabled ? undefined : () => onRemovePlanned(id)} deleteWidth={56}>
          <div style={{ padding: '9px 12px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {label}<span style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{t('workout.set', { n: setIndex + 1 })}</span>
            <span style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-secondary)' }}>
              {suggestion.source !== 'default' ? `${weight} ${t(unit === 'lbs' ? 'units.lbs' : 'units.kg')} × ${suggestion.reps}` : `${exercise.repsMin} ${t('workout.reps').toLowerCase()}`}
            </span>
          </div>
        </SwipeRow>}
        {restHere && renderActive()}
      </div>
    })}
    {!resting && counts[currentId] >= pair.find(ex => ex.exerciseId === currentId).sets && <button disabled={disabled} onClick={onContinue} style={{ minHeight: 44, borderRadius: 10, background: 'var(--accent-color-soft)', color: 'var(--accent-color)' }}>{t('workout.nextExercise')}</button>}
    <button disabled={disabled} onClick={() => setAdding(true)} style={{ marginTop: 8, width: '100%', minHeight: 44, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 10, color: 'var(--fg-secondary)', fontSize: 12, cursor: 'pointer' }}>{t('workout.addSetExtra')}</button>
    <BottomSheet open={adding} onClose={() => setAdding(false)}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{t('superset.add')}</div>
      <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: '8px 0' }}>{t('superset.addHint')}</p>
      {[...pair.map((ex, side) => ({ label: `${side ? 'B' : 'A'} · ${ex.nameRu}`, ids: [ex.exerciseId] })), { label: t('superset.both'), ids: pair.map(ex => ex.exerciseId) }].map(option => <button key={option.label} onClick={() => { onAdd(option.ids); setAdding(false) }} style={{ display: 'block', width: '100%', minHeight: 44, padding: 12, marginTop: 6, borderRadius: 10, border: '1px solid var(--stroke-0)', background: 'var(--surface-0)', color: 'var(--fg-primary)', textAlign: 'left', cursor: 'pointer' }}>{option.label}</button>)}
    </BottomSheet>
  </div>
}
