import { useState } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Button } from '../../../components/ui/Button.jsx'
import { supersetPair } from '../../../utils/supersets.js'

// Lives inside the existing exercise-settings sheet, before alternatives.
export function ProgramSuperset({ exercise, exercises, onChange }) {
  const { t } = useTranslation()
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState(null)
  const pair = supersetPair(exercises, exercise.exerciseId)
  const candidates = exercises.filter(ex => ex.exerciseId !== exercise.exerciseId && !ex.supersetId)
  return <section style={{ padding: '14px 0' }}>
    {pair ? <>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-color)' }}>{t('superset.title')}</div>
      {pair.map((ex, i) => <div key={ex.exerciseId} style={{ padding: '8px 0', fontSize: 13 }}>
        <span style={{ color: 'var(--accent-color)', marginRight: 8 }}>{i ? 'B' : 'A'}</span>{ex.nameRu}
      </div>)}
      <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 10 }}>{t('superset.rest', { seconds: pair[1].restSec ?? 90 })}</div>
      <Button block onClick={() => onChange(null)}>{t('superset.unlink')}</Button>
      <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 8 }}>{t('superset.unlinkHint')}</div>
    </> : choosing ? <>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{t('superset.choose')}</div>
      {candidates.map(ex => <button key={ex.exerciseId} type="button" aria-pressed={selected === ex.exerciseId}
        onClick={() => setSelected(ex.exerciseId)} style={{
          display: 'block', width: '100%', minHeight: 44, padding: 12, textAlign: 'left', marginBottom: 6,
          borderRadius: 10, border: '1px solid var(--stroke-0)', cursor: 'pointer', fontSize: 14,
          background: selected === ex.exerciseId ? 'var(--accent-color-soft)' : 'var(--surface-0)', color: 'var(--fg-primary)',
        }}>{ex.nameRu}</button>)}
      {!candidates.length && <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{t('superset.empty')}</p>}
      <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: '10px 0' }}>{t('superset.hint')}</div>
      <Button block disabled={!selected} onClick={() => { onChange(selected); setChoosing(false); setSelected(null) }}>{t('superset.join')}</Button>
    </> : <Button block onClick={() => setChoosing(true)}>{t('superset.join')}</Button>}
  </section>
}
