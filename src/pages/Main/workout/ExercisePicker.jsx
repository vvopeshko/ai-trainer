import { useState, useMemo } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { useExerciseCatalog } from '../../../hooks/queries.js'
import { getMuscleName, getEquipmentName } from '../../../utils/muscleMapping.js'
import { Icon } from '../../../components/ui/Icon.jsx'

// ─── ExercisePicker ─────────────────────────────────────────────────────

const MAX_RESULTS = 60 // рендерим шапку списка, остальное — через уточнение поиска

export function ExercisePicker({ onSelect }) {
  const { t } = useTranslation()
  // Каталог из общего кэша (persist в localStorage) — без сети на каждый ввод
  // и без отдельного GET /exercises?limit=57. Фильтрация клиентская.
  const { data: catalog = [], isLoading } = useExerciseCatalog()
  const [query, setQuery] = useState('')

  const exercises = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog.slice(0, MAX_RESULTS)
    return catalog
      .filter(ex => {
        const hay = [ex.nameRu, ex.nameEn, ...(ex.primaryMuscles || []), ...(ex.equipment || [])]
          .filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
      .slice(0, MAX_RESULTS)
  }, [catalog, query])

  const loading = isLoading && catalog.length === 0

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
                {(ex.primaryMuscles || []).map(getMuscleName).join(', ')}
                {ex.equipment?.length > 0 ? ` · ${ex.equipment.map(getEquipmentName).join(', ')}` : ''}
              </div>
            </div>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
