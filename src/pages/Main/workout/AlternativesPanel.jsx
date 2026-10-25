import { useEffect, useState } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { useExerciseAlternatives, useExerciseCatalog } from '../../../hooks/queries.js'
import { Icon, Skeleton } from '../../../components/ui/index.js'
import { kgToLbs } from '../../../utils/weightUnit.js'
import { StatusPill } from './ProgressStatus.jsx'

const MAX_ROWS = 8
const MAX_FOUND = 8
const norm = s => s.toLowerCase().replace(/ё/g, 'е')

// "Аналоги" tab of the exercise info sheet during a workout. Variants of one
// program slot: its main exercise (if something else is done today), its own
// alternatives, catalog candidates and a search over the whole catalog. Each
// shows its last result and status; progress stays per exercise (kilograms of
// a machine and of dumbbells don't compare).
export function AlternativesPanel({ current, slot, lastResults, onNeedLastResults, trendById, unit, onPick }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const mainId = slot?.mainExerciseId ?? slot?.exerciseId ?? current?.id
  const { data, isPending } = useExerciseAlternatives(mainId, !!mainId)
  const { data: catalog = [] } = useExerciseCatalog()
  const own = slot?.alternatives ?? []
  const seen = new Set([current?.id, ...own.map(a => a.exerciseId)])
  const main = slot && current?.id !== mainId ? [{ exerciseId: mainId, nameRu: slot.mainNameRu ?? slot.nameRu, slug: slot.mainSlug ?? slot.slug, isMain: true }] : []
  const rows = [...main, ...own.filter(a => a.exerciseId !== mainId), ...(data?.alternatives ?? []).filter(a => !seen.has(a.exerciseId) && a.exerciseId !== mainId)]
    .filter(a => a.exerciseId !== current?.id).slice(0, MAX_ROWS)
  const listed = new Set([current?.id, ...rows.map(r => r.exerciseId)])
  const found = query.trim().length >= 2
    ? catalog.filter(e => !listed.has(e.id) && norm(e.nameRu).includes(norm(query.trim())))
      .slice(0, MAX_FOUND).map(e => ({ exerciseId: e.id, nameRu: e.nameRu, slug: e.slug }))
    : []
  const missing = [...rows, ...found].map(r => r.exerciseId).filter(id => !(id in lastResults)).join(',')
  useEffect(() => {
    if (missing) onNeedLastResults(missing.split(','))
  }, [missing]) // eslint-disable-line react-hooks/exhaustive-deps

  const unitLabel = t(unit === 'lbs' ? 'units.lbs' : 'units.kg')
  const lastText = id => {
    // Not loaded yet ≠ never done: "…" until batch-last-results answers.
    if (!(id in lastResults)) return '…'
    const last = lastResults[id]
    if (!last?.lastSets?.length) return t('workout.alternativeNever')
    const date = new Date(last.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    const sets = last.lastSets.map(s => (s.weightKg ?? 0) > 0 ? `${unit === 'lbs' ? kgToLbs(s.weightKg) : s.weightKg}×${s.reps}` : `${s.reps}`).join(' · ')
    return `${date}: ${sets}${last.lastSets.some(s => (s.weightKg ?? 0) > 0) ? ` ${unitLabel}` : ''}`
  }
  const card = { padding: '11px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }
  const status = id => {
    const trend = trendById.get(id)
    return trend && trend !== 'first' ? <StatusPill trend={trend} /> : null
  }
  const row = alt => (
    <div key={alt.exerciseId} style={{ ...card, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={() => onPick(alt, { makeMain: false })} style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 0,
        background: 'none', border: 0, textAlign: 'left', cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
            {alt.nameRu}{alt.isMain && <span style={{ fontWeight: 400, color: 'var(--fg-tertiary)' }}> · {t('workout.alternativeMain')}</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>{lastText(alt.exerciseId)}</div>
        </div>
        {status(alt.exerciseId)}
      </button>
      {slot && !alt.isMain && <button onClick={() => onPick(alt, { makeMain: true })} style={{
        flexShrink: 0, padding: '6px 9px', borderRadius: 8, border: 0, cursor: 'pointer',
        background: 'rgba(236,234,239,0.08)', color: 'var(--fg-secondary)', fontSize: 11, fontWeight: 600,
      }}>{t('workout.makeMain')}</button>}
    </div>
  )

  return <div>
    <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginBottom: 'var(--space-3)' }}>{t('workout.alternativesHint')}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {current && <div style={{ ...card, background: 'hsla(var(--accent-h,158),55%,55%,0.10)', border: '1px solid hsla(var(--accent-h,158),55%,55%,0.25)' }}>
        <Icon name="check" size={14} strokeWidth={3} style={{ color: 'hsl(var(--accent-h,158),55%,60%)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>{current.nameRu}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>{t('workout.currentExercise')} · {lastText(current.id)}</div>
        </div>
        {status(current.id)}
      </div>}
      {rows.map(row)}
      {isPending && <Skeleton width="100%" height={52} radius={12} />}
      {!isPending && !rows.length && <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{t('workout.alternativesEmpty')}</div>}
    </div>

    {/* Any exercise from the catalog: picking it also remembers it in the slot */}
    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-primary)', margin: '18px 0 8px' }}>{t('workout.searchCatalogTitle')}</div>
    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('workout.searchCatalog')} style={{
      width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
      color: 'var(--fg-primary)', fontSize: 13, outline: 'none',
    }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
      {found.map(row)}
      {query.trim().length >= 2 && !found.length && <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{t('workout.searchCatalogEmpty')}</div>}
    </div>
  </div>
}
