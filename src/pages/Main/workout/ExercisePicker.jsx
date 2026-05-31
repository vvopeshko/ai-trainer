import { useState, useEffect } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { apiGet } from '../../../utils/api.js'
import { Icon } from '../../../components/ui/Icon.jsx'

// ─── ExercisePicker ─────────────────────────────────────────────────────

export function ExercisePicker({ onSelect }) {
  const { t } = useTranslation()
  const [exercises, setExercises] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = query.length >= 2
          ? await apiGet(`/api/v1/exercises/search?q=${encodeURIComponent(query)}`)
          : await apiGet('/api/v1/exercises?limit=57')
        if (!cancelled) setExercises(data.exercises)
      } catch (err) {
        console.error('Failed to load exercises:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    const timer = setTimeout(load, query ? 300 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('workout.search')}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)', background: 'var(--surface-0)',
            color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading && <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>...</div>}
        {!loading && exercises.length === 0 && (
          <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>{t('workout.noExercises')}</div>
        )}
        {exercises.map(ex => (
          <button key={ex.id} onClick={() => onSelect(ex)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)', background: 'var(--surface-0)',
            color: 'var(--fg-primary)', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', width: '100%',
          }}>
            <Icon name="dumbbell" size={16} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--weight-medium)' }}>{ex.nameRu}</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
                {(ex.primaryMuscles || []).join(', ')}
                {ex.equipment?.length > 0 ? ` · ${ex.equipment.join(', ')}` : ''}
              </div>
            </div>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
