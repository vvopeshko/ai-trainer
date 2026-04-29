/**
 * Library Page — каталог упражнений (BRD §12).
 *
 * Загружает все упражнения (лёгкие поля) одним запросом.
 * Клиентская фильтрация: текстовый поиск + мышечная группа + оборудование.
 * Детали — в BottomSheet по тапу (полный запрос GET /exercises/:id).
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet } from '../../utils/api.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'

// ─── Constants ────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  { key: 'chest',     muscles: ['chest'],     icon: 'chest' },
  { key: 'back',      muscles: ['lats', 'middle back', 'traps'], icon: 'back' },
  { key: 'shoulders', muscles: ['shoulders'], icon: 'shoulder' },
  { key: 'arms',      muscles: ['biceps', 'triceps', 'forearms'], icon: 'arm' },
  { key: 'legs',      muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors'], icon: 'leg' },
  { key: 'core',      muscles: ['abdominals', 'obliques'], icon: 'abs' },
]

const EQUIPMENT_TYPES = ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'other']

const DEBOUNCE_MS = 300

// ─── Helpers ──────────────────────────────────────────────────────────

function useDebounce(value, ms) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function matchesSearch(ex, q) {
  const lower = q.toLowerCase()
  if (ex.nameRu?.toLowerCase().includes(lower)) return true
  if (ex.nameEn?.toLowerCase().includes(lower)) return true
  if (ex.aliases?.some(a => a.toLowerCase().includes(lower))) return true
  return false
}

// ─── Chip ─────────────────────────────────────────────────────────────

function Chip({ label, active, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '6px 12px',
        borderRadius: 20,
        border: active ? '1px solid hsla(var(--accent-h,158),60%,50%,0.5)' : '1px solid rgba(255,255,255,0.1)',
        background: active ? 'hsla(var(--accent-h,158),60%,40%,0.25)' : 'rgba(255,255,255,0.06)',
        color: active ? 'hsl(var(--accent-h,158),60%,70%)' : 'var(--fg-secondary)',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'all 0.15s ease',
      }}
    >
      {icon && <Icon name={icon} size={14} strokeWidth={2} />}
      {label}
    </button>
  )
}

// ─── Search Bar ───────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder }) {
  const inputRef = useRef(null)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: '10px var(--space-3)',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <Icon name="search" size={18} strokeWidth={2} style={{ color: 'var(--fg-tertiary)', flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: 'var(--fg-primary)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.4,
        }}
      />
      {value && (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--fg-tertiary)' }}
        >
          <Icon name="x" size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

// ─── Chip Scroll Row ──────────────────────────────────────────────────

function ChipRow({ children }) {
  return (
    <div style={{
      display: 'flex', gap: 'var(--space-2)',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      paddingBottom: 2,
    }}>
      {children}
    </div>
  )
}

// ─── Exercise Row ─────────────────────────────────────────────────────

function ExerciseRow({ exercise, isLast, onClick }) {
  const subtitle = [
    ...(exercise.primaryMuscles || []).slice(0, 2),
    ...(exercise.equipment || []).slice(0, 1),
  ].join(' · ')

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        width: '100%',
        padding: 'var(--space-3) 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
        background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--fg-primary)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {exercise.nameRu}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
            marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </div>
        )}
      </div>
      <Icon name="chevronRight" size={16} style={{ color: 'var(--fg-disabled)', flexShrink: 0 }} />
    </button>
  )
}

// ─── Detail Sheet Content ─────────────────────────────────────────────

function ExerciseDetail({ exercise, t }) {
  if (!exercise) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Title */}
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg-primary)' }}>
        {exercise.nameRu}
      </div>

      {/* GIF */}
      {exercise.gifUrl && (
        <img
          src={exercise.gifUrl}
          alt={exercise.nameRu}
          style={{
            width: '100%', maxHeight: 200, objectFit: 'contain',
            borderRadius: 12, background: 'rgba(255,255,255,0.04)',
          }}
        />
      )}

      {/* Badges: difficulty + category */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {exercise.difficulty && (
          <span style={{
            padding: '3px 10px', borderRadius: 12,
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'rgba(255,255,255,0.08)', color: 'var(--fg-secondary)',
          }}>
            {t(`library.diff.${exercise.difficulty}`)}
          </span>
        )}
        {exercise.category && (
          <span style={{
            padding: '3px 10px', borderRadius: 12,
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'rgba(255,255,255,0.08)', color: 'var(--fg-secondary)',
          }}>
            {t(`library.cat.${exercise.category}`)}
          </span>
        )}
      </div>

      {/* Primary muscles */}
      {exercise.primaryMuscles?.length > 0 && (
        <DetailSection label={t('library.muscles')}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {exercise.primaryMuscles.map(m => (
              <span key={m} style={{
                padding: '3px 10px', borderRadius: 12,
                fontSize: 'var(--text-xs)',
                background: 'hsla(var(--accent-h,158),60%,40%,0.2)',
                color: 'hsl(var(--accent-h,158),60%,70%)',
              }}>
                {m}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Equipment */}
      {exercise.equipment?.length > 0 && (
        <DetailSection label={t('library.equipment')}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {exercise.equipment.map(eq => (
              <span key={eq} style={{
                padding: '3px 10px', borderRadius: 12,
                fontSize: 'var(--text-xs)',
                background: 'rgba(255,255,255,0.08)', color: 'var(--fg-secondary)',
              }}>
                {t(`library.equip.${eq}`)}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Instructions */}
      {exercise.instructions && (
        <DetailSection label={t('library.instructions')}>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {exercise.instructions}
          </p>
        </DetailSection>
      )}

      {/* Typical mistakes */}
      {exercise.typicalMistakes && (
        <DetailSection label={t('library.mistakes')}>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {exercise.typicalMistakes}
          </p>
        </DetailSection>
      )}

      {/* Description */}
      {exercise.description && (
        <DetailSection label={t('library.description')}>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {exercise.description}
          </p>
        </DetailSection>
      )}
    </div>
  )
}

function DetailSection({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Skeleton height={42} radius={12} />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {[80, 70, 80, 65, 60, 55].map((w, i) => <Skeleton key={i} width={w} height={32} radius={20} />)}
      </div>
      <Glass padding="var(--space-3) var(--space-4)">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{
            padding: 'var(--space-3) 0',
            borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <Skeleton width="65%" height={14} />
            <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
          </div>
        ))}
      </Glass>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { t } = useTranslation()

  // Data
  const [allExercises, setAllExercises] = useState([])
  const [loaded, setLoaded] = useState(false)

  // Filters
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS)
  const [selectedMuscle, setSelectedMuscle] = useState(null)
  const [selectedEquipment, setSelectedEquipment] = useState(null)

  // Detail sheet
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Load all exercises once
  useEffect(() => {
    apiGet('/api/v1/exercises?limit=1500')
      .then(data => {
        setAllExercises(data.exercises)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = allExercises

    // Text search
    if (debouncedQuery.trim()) {
      list = list.filter(ex => matchesSearch(ex, debouncedQuery.trim()))
    }

    // Muscle group filter
    if (selectedMuscle) {
      const group = MUSCLE_GROUPS.find(g => g.key === selectedMuscle)
      if (group) {
        list = list.filter(ex =>
          ex.primaryMuscles?.some(m => group.muscles.includes(m))
        )
      }
    }

    // Equipment filter
    if (selectedEquipment) {
      list = list.filter(ex =>
        ex.equipment?.includes(selectedEquipment)
      )
    }

    return list
  }, [allExercises, debouncedQuery, selectedMuscle, selectedEquipment])

  // Open detail sheet
  const openDetail = useCallback((exerciseId) => {
    setDetailLoading(true)
    setSheetOpen(true)
    setSelectedExercise(null)
    apiGet(`/api/v1/exercises/${exerciseId}`)
      .then(data => setSelectedExercise(data.exercise))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }, [])

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    setSelectedExercise(null)
  }, [])

  // Toggle helpers
  const toggleMuscle = useCallback((key) => {
    setSelectedMuscle(prev => prev === key ? null : key)
  }, [])

  const toggleEquipment = useCallback((key) => {
    setSelectedEquipment(prev => prev === key ? null : key)
  }, [])

  return (
    <div style={{ padding: 'var(--space-5) var(--space-4) var(--space-10)' }}>
      {/* Title */}
      <h1 style={{
        fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--fg-primary)',
        margin: '0 0 var(--space-4)',
      }}>
        {t('library.title')}
      </h1>

      {!loaded ? (
        <ListSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Search */}
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('library.search')}
          />

          {/* Muscle group chips */}
          <ChipRow>
            {MUSCLE_GROUPS.map(g => (
              <Chip
                key={g.key}
                label={t(`library.muscle.${g.key}`)}
                icon={g.icon}
                active={selectedMuscle === g.key}
                onClick={() => toggleMuscle(g.key)}
              />
            ))}
          </ChipRow>

          {/* Equipment chips */}
          <ChipRow>
            {EQUIPMENT_TYPES.map(eq => (
              <Chip
                key={eq}
                label={t(`library.equip.${eq}`)}
                active={selectedEquipment === eq}
                onClick={() => toggleEquipment(eq)}
              />
            ))}
          </ChipRow>

          {/* Count */}
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)' }}>
            {t('library.count', { n: filtered.length })}
          </div>

          {/* Exercise list */}
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 'var(--space-8) 0',
              color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)',
            }}>
              {t('library.noResults')}
            </div>
          ) : (
            <Glass padding="0 var(--space-4)">
              {filtered.map((ex, i) => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  isLast={i === filtered.length - 1}
                  onClick={() => openDetail(ex.id)}
                />
              ))}
            </Glass>
          )}
        </div>
      )}

      {/* Detail Bottom Sheet */}
      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        {detailLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
            <Skeleton width="60%" height={20} />
            <Skeleton height={160} radius={12} />
            <Skeleton width="40%" height={14} />
            <Skeleton height={60} />
          </div>
        ) : (
          <ExerciseDetail exercise={selectedExercise} t={t} />
        )}
      </BottomSheet>
    </div>
  )
}
