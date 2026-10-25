import { useMemo, useState } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { useExerciseAlternatives, useExerciseCatalog } from '../../../hooks/queries.js'
import { Icon } from '../../../components/ui/Icon.jsx'

const MAX_ALTERNATIVES = 6
const norm = s => s.toLowerCase().replace(/ё/g, 'е')
const chip = {
  padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', color: 'var(--fg-secondary)', fontSize: 'var(--text-xs)',
}

// Alternatives of one program slot: make one the main exercise, remove, or add
// from catalog suggestions / search. Edits go into the edited plan and are
// saved with the rest of the program; history of every exercise stays.
export function ProgramAlternatives({ exercise, onChange }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const { data: catalog = [] } = useExerciseCatalog()
  const { data: suggested } = useExerciseAlternatives(exercise.exerciseId)
  const byId = useMemo(() => new Map(catalog.map(e => [e.id, e])), [catalog])
  const alternatives = exercise.alternatives ?? []
  const taken = new Set([exercise.exerciseId, ...alternatives])
  const full = alternatives.length >= MAX_ALTERNATIVES
  const suggestions = (suggested?.alternatives ?? []).filter(a => !taken.has(a.exerciseId)).slice(0, 5)
  const results = query.trim().length >= 2
    ? catalog.filter(e => !taken.has(e.id) && norm(e.nameRu).includes(norm(query.trim()))).slice(0, 6)
    : []

  const add = id => {
    if (full || taken.has(id)) return
    onChange({ alternatives: [...alternatives, id] })
    setQuery('')
  }
  const remove = id => onChange({ alternatives: alternatives.filter(a => a !== id) })
  const makeMain = id => {
    const next = byId.get(id)
    if (!next) return
    onChange({
      exerciseId: next.id, nameRu: next.nameRu, slug: next.slug,
      alternatives: [exercise.exerciseId, ...alternatives.filter(a => a !== id)],
    })
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)', marginBottom: 6 }}>{t('program.alternatives')}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginBottom: 8 }}>{t('program.alternativesHint')}</div>

      {alternatives.map(id => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--fg-primary)' }}>
            {byId.get(id)?.nameRu ?? '…'}
          </span>
          <button onClick={() => makeMain(id)} style={chip}>{t('workout.makeMain')}</button>
          <button onClick={() => remove(id)} aria-label={t('program.removeAlternative')} style={{ ...chip, padding: 6, display: 'flex' }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      {!alternatives.length && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', padding: '4px 0' }}>{t('program.noAlternatives')}</div>}

      {!full && <>
        {suggestions.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {suggestions.map(s => <button key={s.exerciseId} onClick={() => add(s.exerciseId)} style={chip}>+ {s.nameRu}</button>)}
        </div>}
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('program.searchAlternative')}
          style={{
            width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '9px 12px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
            color: 'var(--fg-primary)', fontSize: 'var(--text-sm)', outline: 'none',
          }} />
        {results.map(e => (
          <button key={e.id} onClick={() => add(e.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 2px', border: 'none',
            background: 'none', color: 'var(--fg-primary)', fontSize: 'var(--text-sm)', cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>+ {e.nameRu}</button>
        ))}
      </>}
    </div>
  )
}
