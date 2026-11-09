import { useState, useMemo } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { useExerciseCatalog } from '../../../hooks/queries.js'
import { useCreateCustomExercise } from '../../../hooks/mutations.js'
import { getMuscleName, getEquipmentName } from '../../../utils/muscleMapping.js'
import { Icon } from '../../../components/ui/Icon.jsx'
import { ExerciseSearchField } from '../../../components/ui/ExerciseSearchField.jsx'
import { searchExercises, byPopularity, isStretchOrCardio, normalizeSearch } from '../../../utils/exerciseSearch.js'

// ─── ExercisePicker ─────────────────────────────────────────────────────

const MAX_RESULTS = 60 // рендерим шапку списка, остальное — через уточнение поиска

export function ExercisePicker({ onSelect }) {
  const { t } = useTranslation()
  // Каталог из общего кэша (persist в localStorage) — без сети на каждый ввод
  // и без отдельного GET /exercises?limit=57. Фильтрация клиентская.
  const { data: catalog = [], isLoading } = useExerciseCatalog()
  const [query, setQuery] = useState('')

  // Without a query: what people actually do, strength work only. A search
  // covers the whole catalog, stretches included, best match first.
  const exercises = useMemo(() => {
    if (!query.trim()) return byPopularity(catalog.filter(ex => !isStretchOrCardio(ex))).slice(0, MAX_RESULTS)
    return searchExercises(catalog, query).slice(0, MAX_RESULTS)
  }, [catalog, query])

  const select = exercise => {
    document.activeElement?.blur?.()
    onSelect(exercise)
  }

  const loading = isLoading && catalog.length === 0

  // Own exercise when the catalog has nothing that fits. The server first
  // checks the catalog: a likely match comes back as a suggestion.
  const createExercise = useCreateCustomExercise()
  const [suggestion, setSuggestion] = useState(null)
  const name = query.trim().replace(/\s+/g, ' ')
  const exactHit = exercises.some(ex => normalizeSearch(ex.nameRu) === normalizeSearch(name))
  const canCreate = name.length >= 2 && !exactHit
  const create = force => {
    createExercise.mutate({ nameRu: name, force }, {
      onSuccess: result => {
        if (result.suggestion) setSuggestion(result.suggestion)
        else select(result.exercise)
      },
    })
  }
  const changeQuery = value => {
    setQuery(value)
    setSuggestion(null)
    createExercise.reset()
  }

  return (
    <div style={{ padding: '0 16px calc(24px + var(--safe-bottom, 0px))', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 56px)', zIndex: 2, padding: '12px 0', background: 'var(--bg-app)' }}>
        <ExerciseSearchField value={query} onChange={changeQuery} placeholder={t('workout.search')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading && <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>...</div>}
        {!loading && exercises.length === 0 && (
          <div style={{ color: 'var(--fg-tertiary)', textAlign: 'center', padding: 20 }}>{t('workout.noExercises')}</div>
        )}
        {exercises.map(ex => (
          <button key={ex.id} onClick={() => select(ex)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            minHeight: 60, padding: '12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)', background: 'var(--surface-0)',
            color: 'var(--fg-primary)', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-sans)', fontSize: 15, width: '100%',
          }}>
            <Icon name="dumbbell" size={16} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--weight-medium)' }}>
                {ex.nameRu}
                {ex.own && <span style={{ marginLeft: 6, fontSize: 'var(--text-2xs)', color: 'var(--accent-color)' }}>{t('workout.ownExercise')}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                {(ex.primaryMuscles || []).map(getMuscleName).join(', ')}
                {ex.equipment?.length > 0 ? ` · ${ex.equipment.map(getEquipmentName).join(', ')}` : ''}
              </div>
            </div>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)' }} />
          </button>
        ))}

        {canCreate && !suggestion && (
          <button onClick={() => create(false)} disabled={createExercise.isPending} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            minHeight: 60, padding: '12px', borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-medium)', background: 'transparent',
            color: 'var(--accent-color)', cursor: createExercise.isPending ? 'default' : 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-sans)', fontSize: 15, width: '100%',
          }}>
            <Icon name="plus" size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {createExercise.isPending ? t('workout.createChecking') : t('workout.createExercise', { name })}
            </span>
          </button>
        )}

        {suggestion && (
          <div style={{
            padding: '12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)', background: 'var(--surface-0)',
            display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--fg-primary)',
          }}>
            <span>{t('workout.similarFound', { name: suggestion.nameRu })}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => select(suggestion)} style={{
                padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'hsl(var(--accent-h),55%,55%)', color: '#0a1815', fontWeight: 600, fontSize: 'var(--text-sm)',
              }}>{t('workout.useSuggestion')}</button>
              <button onClick={() => { setSuggestion(null); create(true) }} style={{
                padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'transparent',
                border: '1px solid var(--border-medium)', color: 'var(--fg-secondary)', fontSize: 'var(--text-sm)',
              }}>{t('workout.createAnyway')}</button>
            </div>
          </div>
        )}

        {createExercise.isError && (
          <div style={{ color: 'var(--danger)', fontSize: 'var(--text-xs)', padding: '0 4px' }}>{t('workout.createFailed')}</div>
        )}
      </div>
    </div>
  )
}
