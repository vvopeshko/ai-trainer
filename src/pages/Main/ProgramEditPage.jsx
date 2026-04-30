/**
 * Program Edit Page — просмотр и редактирование активной программы.
 *
 * Full-screen flow (без таббара), вход из Home через тап на ProgrammeHero.
 * Данные: локальный state, загрузка через GET /programs/:id.
 * Редактирование: удаление/reorder упражнений, изменение sets/reps/rest, rename дня.
 * Сохранение: PATCH /programs/:id с полной заменой planJson.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPatch, apiPost } from '../../utils/api.js'
import { useHomeData } from '../../contexts/HomeDataContext.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import TopBar from '../../components/ui/TopBar.jsx'

// ─── Muscle label + grouping ───────────────────────────────────────────

// Группировка для мышечных объёмов (бейджи)
const MUSCLE_GROUP = {
  chest: 'Грудь', upper_chest: 'Грудь', mid_chest: 'Грудь', lower_chest: 'Грудь',
  back: 'Спина', lats: 'Спина', upper_back: 'Спина', middle_back: 'Спина',
  traps: 'Спина',
  shoulders: 'Плечи', front_delts: 'Плечи', side_delts: 'Плечи', rear_delts: 'Плечи',
  biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предплечья',
  quads: 'Ноги', quadriceps: 'Ноги', hamstrings: 'Ноги', glutes: 'Ноги',
  calves: 'Ноги', adductors: 'Ноги', abductors: 'Ноги',
  abs: 'Пресс', abdominals: 'Пресс', core: 'Пресс',
}

// Подробные названия для строк упражнений
const MUSCLE_NAME = {
  chest: 'грудь', upper_chest: 'верх груди', mid_chest: 'середина груди', lower_chest: 'низ груди',
  back: 'спина', lats: 'широчайшие', upper_back: 'верх спины', middle_back: 'середина спины',
  traps: 'трапеции',
  shoulders: 'плечи', front_delts: 'передние дельты', side_delts: 'средние дельты', rear_delts: 'задние дельты',
  biceps: 'бицепс', triceps: 'трицепс', forearms: 'предплечья',
  quads: 'квадрицепс', quadriceps: 'квадрицепс', hamstrings: 'бицепс бедра', glutes: 'ягодицы',
  calves: 'икры', adductors: 'приводящие', abductors: 'отводящие',
  abs: 'пресс', abdominals: 'пресс', core: 'кор',
}

function getMuscleGroup(key) {
  return MUSCLE_GROUP[key] || key
}

function getMuscleName(key) {
  return MUSCLE_NAME[key] || key
}

// ─── Compute muscle volume (grouped) ──────────────────────────────────

function computeMuscleVolume(days) {
  const volume = {}
  for (const day of days) {
    for (const ex of day.exercises || []) {
      for (const muscle of ex.primaryMuscles || []) {
        const group = getMuscleGroup(muscle)
        volume[group] = (volume[group] || 0) + (ex.sets || 0)
      }
    }
  }
  return Object.entries(volume)
    .sort((a, b) => b[1] - a[1])
    .map(([label, sets]) => ({ label, sets }))
}

// ─── Estimate day duration ─────────────────────────────────────────────

function estimateDayMin(exercises) {
  return Math.round((exercises || []).reduce((sum, ex) => {
    const sets = ex.sets || 3
    return sum + sets * 1.5 + (sets - 1) * (ex.restSec || 90) / 60
  }, 0))
}

// ─── Deep clone helper ─────────────────────────────────────────────────

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan))
}

// ─── Stepper control ───────────────────────────────────────────────────

function Stepper({ value, min = 1, max = 20, onChange, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: 'none', color: value <= min ? 'var(--fg-disabled)' : 'var(--fg-primary)',
            cursor: value <= min ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="minus" size={16} />
        </button>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--fg-primary)',
          minWidth: 28, textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: 'none', color: value >= max ? 'var(--fg-disabled)' : 'var(--fg-primary)',
            cursor: value >= max ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────

export default function ProgramEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { refresh } = useHomeData()

  // Data
  const [program, setProgram] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edits (lazy copy on first mutation)
  const [editedPlan, setEditedPlan] = useState(null)
  const [editedName, setEditedName] = useState(null)
  const [saving, setSaving] = useState(false)

  // Activate
  const [activating, setActivating] = useState(false)

  // Other programs
  const [otherPrograms, setOtherPrograms] = useState(null)

  // UI
  const [expandedDays, setExpandedDays] = useState(new Set([0]))
  const [editingExercise, setEditingExercise] = useState(null) // { dayIdx, exIdx }
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [editingDayTitle, setEditingDayTitle] = useState(null) // dayIdx or null
  const dayTitleRef = useRef(null)

  // Drag state
  const [dragState, setDragState] = useState(null)

  const isDirty = editedPlan !== null || editedName !== null
  const plan = editedPlan ?? program?.planJson

  // ─── Load ──────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      apiGet('/api/v1/programs/' + id),
      apiGet('/api/v1/programs'),
    ])
      .then(([progData, listData]) => {
        setProgram(progData.program)
        setOtherPrograms((listData.programs || []).filter(p => p.id !== id))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [id])

  // ─── Ensure plan copy for edits ────────────────────────────────────

  const ensureEditedPlan = useCallback(() => {
    if (!editedPlan && program?.planJson) {
      const copy = clonePlan(program.planJson)
      setEditedPlan(copy)
      return copy
    }
    return editedPlan
  }, [editedPlan, program])

  // ─── Edit operations ──────────────────────────────────────────────

  const handleRemoveExercise = (dayIdx, exIdx) => {
    const p = ensureEditedPlan() || clonePlan(program.planJson)
    p.days[dayIdx].exercises.splice(exIdx, 1)
    setEditedPlan({ ...p })
    setEditingExercise(null)
  }

  const handleUpdateExercise = (dayIdx, exIdx, updates) => {
    const p = ensureEditedPlan() || clonePlan(program.planJson)
    p.days[dayIdx].exercises[exIdx] = { ...p.days[dayIdx].exercises[exIdx], ...updates }
    setEditedPlan({ ...p })
  }

  const handleRenameDayTitle = (dayIdx, title) => {
    const p = ensureEditedPlan() || clonePlan(program.planJson)
    p.days[dayIdx].title = title
    setEditedPlan({ ...p })
    setEditingDayTitle(null)
  }

  // ─── Drag reorder ─────────────────────────────────────────────────

  const handleDragStart = (dayIdx, exIdx, e) => {
    const touch = e.touches[0]
    setDragState({ dayIdx, exIdx, startY: touch.clientY, currentIdx: exIdx })
  }

  const handleDragMove = (e) => {
    if (!dragState) return
    e.preventDefault()
    const touch = e.touches[0]
    const dy = touch.clientY - dragState.startY
    const steps = Math.round(dy / 52) // ~52px per row
    const exercises = (plan?.days?.[dragState.dayIdx]?.exercises || [])
    const newIdx = Math.max(0, Math.min(exercises.length - 1, dragState.exIdx + steps))
    if (newIdx !== dragState.currentIdx) {
      setDragState(prev => ({ ...prev, currentIdx: newIdx }))
    }
  }

  const handleDragEnd = () => {
    if (!dragState || dragState.exIdx === dragState.currentIdx) {
      setDragState(null)
      return
    }
    const p = ensureEditedPlan() || clonePlan(program.planJson)
    const exercises = p.days[dragState.dayIdx].exercises
    const [moved] = exercises.splice(dragState.exIdx, 1)
    exercises.splice(dragState.currentIdx, 0, moved)
    setEditedPlan({ ...p })
    setDragState(null)
  }

  // ─── Save ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {}
      if (editedPlan) body.planJson = editedPlan
      if (editedName) body.name = editedName
      await apiPatch('/api/v1/programs/' + id, body)
      setProgram(prev => ({ ...prev, ...body, updatedAt: new Date().toISOString() }))
      setEditedPlan(null)
      setEditedName(null)
      refresh()
    } catch (err) {
      console.error('Failed to save program:', err)
    } finally {
      setSaving(false)
    }
  }

  // ─── Back navigation ──────────────────────────────────────────────

  const goBack = useCallback(() => {
    // When opened from Telegram web_app button there's no history to go back to.
    // Always navigate to home to be safe.
    navigate('/')
  }, [navigate])

  const handleBack = () => {
    if (isDirty) {
      setConfirmLeave(true)
    } else {
      goBack()
    }
  }

  const handleConfirmLeave = () => {
    setConfirmLeave(false)
    goBack()
  }

  // ─── Activate ───────────────────────────────────────────────────

  const handleActivate = async () => {
    setActivating(true)
    try {
      await apiPost('/api/v1/programs/' + id + '/activate')
      setProgram(prev => ({ ...prev, isActive: true }))
      setOtherPrograms(prev => prev?.map(p => ({ ...p, isActive: false })))
      refresh()
    } catch (err) {
      console.error('Failed to activate program:', err)
    } finally {
      setActivating(false)
    }
  }

  // ─── Toggle day ───────────────────────────────────────────────────

  const toggleDay = (idx) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // ─── Editing exercise BottomSheet data ────────────────────────────

  const editEx = editingExercise
    ? plan?.days?.[editingExercise.dayIdx]?.exercises?.[editingExercise.exIdx]
    : null

  // ─── Loading state ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
        <TopBar title={t('program.title')} onBack={() => navigate('/')} />
        <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
          <Glass style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
            <Skeleton width="35%" height={12} />
          </Glass>
          {[0, 1, 2].map(i => (
            <Glass key={i} style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
              <Skeleton width="50%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="30%" height={10} />
            </Glass>
          ))}
        </div>
      </div>
    )
  }

  if (error || !program) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
        <TopBar title={t('program.title')} onBack={() => navigate('/')} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)',
        }}>
          {t('program.loadError')}
        </div>
      </div>
    )
  }

  // ─── Computed data ────────────────────────────────────────────────

  const days = plan?.days || []
  const totalExercises = days.reduce((sum, d) => sum + (d.exercises?.length || 0), 0)
  const muscleVolume = computeMuscleVolume(days)
  const displayName = editedName ?? program.name

  return (
    <div
      style={{ background: 'var(--bg-app)', minHeight: '100vh' }}
      onTouchMove={dragState ? handleDragMove : undefined}
      onTouchEnd={dragState ? handleDragEnd : undefined}
    >
      <TopBar
        title={t('program.title')}
        onBack={handleBack}
        rightLabel={isDirty ? (saving ? t('program.saving') : t('program.save')) : undefined}
        onRight={isDirty ? handleSave : undefined}
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          paddingTop: 'var(--safe-top, 0px)',
        }}
      />

      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>

        {/* ── Program Header ── */}
        <Glass padding={0} style={{
          marginBottom: 'var(--space-4)',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, hsla(var(--accent-h,158),40%,18%,0.55) 0%, transparent 50%), var(--surface-0)',
        }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'hsla(var(--accent-h,158),40%,30%,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'hsl(var(--accent-h,158),55%,72%)',
                flexShrink: 0,
              }}>
                <Icon name="zap" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--fg-primary)',
                }}>
                  {displayName}
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex', gap: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--fg-tertiary)',
            }}>
              <span>{t('program.nDays', { n: days.length })}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{t('program.nExercises', { n: totalExercises })}</span>
              {days.length > 0 && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{t('program.avgPerDay', { n: Math.round(totalExercises / days.length) })}</span>
                </>
              )}
            </div>
          </div>
        </Glass>

        {/* ── Muscle Targets (badges) ── */}
        {muscleVolume.length > 0 && (
          <Glass style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: 'var(--tracking-caps)',
              textTransform: 'uppercase',
              color: 'var(--fg-tertiary)',
              marginBottom: 'var(--space-3)',
            }}>
              {t('program.muscleTargets')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {muscleVolume.map(m => (
                <span key={m.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--fg-secondary)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'var(--fg-primary)', fontWeight: 500 }}>{m.label}</span>
                  <span style={{
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--fg-tertiary)',
                  }}>
                    {m.sets}
                  </span>
                </span>
              ))}
            </div>
          </Glass>
        )}

        {/* ── Activate Button ── */}
        {!program.isActive && (
          <button
            onClick={handleActivate}
            disabled={activating}
            style={{
              width: '100%',
              padding: '14px',
              marginBottom: 'var(--space-4)',
              background: 'hsla(var(--accent-h,158),45%,25%,0.3)',
              border: '1px solid hsla(var(--accent-h,158),45%,40%,0.3)',
              borderRadius: 'var(--radius-lg, 14px)',
              color: 'hsl(var(--accent-h,158),55%,72%)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: activating ? 'default' : 'pointer',
              opacity: activating ? 0.6 : 1,
            }}
          >
            {activating ? t('program.activating') : t('program.activate')}
          </button>
        )}

        {/* ── Active badge ── */}
        {program.isActive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 'var(--space-4)',
            padding: '8px 12px',
            background: 'hsla(var(--accent-h,158),40%,20%,0.2)',
            borderRadius: 'var(--radius-md, 10px)',
            width: 'fit-content',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'hsl(var(--accent-h,158),55%,72%)',
          }}>
            <Icon name="check" size={14} />
            {t('program.active')}
          </div>
        )}

        {/* ── Day Cards ── */}
        {days.map((day, dayIdx) => {
          const expanded = expandedDays.has(dayIdx)
          const exercises = day.exercises || []
          const estMin = estimateDayMin(exercises)

          return (
            <Glass key={dayIdx} padding={0} style={{ marginBottom: 'var(--space-3)', overflow: 'hidden' }}>
              {/* Day header */}
              <button
                onClick={() => toggleDay(dayIdx)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  padding: '14px var(--space-4)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                }}
              >
                {/* Day type badge */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `hsla(${[158, 140, 45, 330][dayIdx % 4]}, 40%, 30%, 0.3)`,
                  color: `hsl(${[158, 140, 45, 330][dayIdx % 4]}, 55%, 72%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-sm)', fontWeight: 700,
                }}>
                  {dayIdx + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingDayTitle === dayIdx ? (
                    <input
                      ref={dayTitleRef}
                      defaultValue={day.title}
                      onClick={e => e.stopPropagation()}
                      onBlur={e => handleRenameDayTitle(dayIdx, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6, padding: '4px 8px',
                        color: 'var(--fg-primary)', fontSize: 'var(--text-sm)',
                        fontWeight: 600, outline: 'none',
                      }}
                      autoFocus
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingDayTitle(dayIdx) }}
                      style={{
                        fontSize: 'var(--text-sm)', fontWeight: 600,
                        color: 'var(--fg-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                    >
                      {day.title}
                    </div>
                  )}
                  <div style={{
                    fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginTop: 2,
                  }}>
                    {t('program.dayExercises', { n: exercises.length })}
                    {estMin > 0 && ` · ${t('program.dayEstimate', { n: estMin })}`}
                  </div>
                </div>

                <Icon
                  name="chevronRight"
                  size={16}
                  style={{
                    color: 'var(--fg-disabled)', flexShrink: 0,
                    transform: expanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              {/* Expanded: exercise list */}
              {expanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {exercises.map((ex, exIdx) => {
                    const isDragging = dragState?.dayIdx === dayIdx && dragState?.exIdx === exIdx
                    const isTarget = dragState?.dayIdx === dayIdx && dragState?.currentIdx === exIdx && dragState?.exIdx !== exIdx

                    return (
                      <div
                        key={ex.exerciseId + exIdx}
                        style={{
                          display: 'flex', alignItems: 'center',
                          padding: '10px var(--space-4)',
                          gap: 'var(--space-3)',
                          borderTop: exIdx > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                          opacity: isDragging ? 0.4 : 1,
                          background: isTarget ? 'rgba(255,255,255,0.03)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* Drag handle */}
                        <div
                          onTouchStart={(e) => handleDragStart(dayIdx, exIdx, e)}
                          style={{
                            cursor: 'grab', padding: 2, flexShrink: 0,
                            color: 'var(--fg-disabled)', touchAction: 'none',
                          }}
                        >
                          <Icon name="grip" size={14} />
                        </div>

                        {/* Number badge */}
                        <div style={{
                          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 600, color: 'var(--fg-tertiary)',
                        }}>
                          {exIdx + 1}
                        </div>

                        {/* Exercise info (tappable for edit) */}
                        <div
                          onClick={() => setEditingExercise({ dayIdx, exIdx })}
                          style={{
                            flex: 1, minWidth: 0, cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            fontSize: 'var(--text-sm)', color: 'var(--fg-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {ex.nameRu}
                          </div>
                          <div style={{
                            fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginTop: 1,
                          }}>
                            {ex.sets}×{ex.repsMax || ex.repsMin}
                            {(ex.primaryMuscles?.length > 0 || ex.secondaryMuscles?.length > 0) && (
                              <span style={{ opacity: 0.5 }}> · {
                                [...(ex.primaryMuscles || []), ...(ex.secondaryMuscles || [])]
                                  .map(getMuscleName)
                                  .filter((v, i, a) => a.indexOf(v) === i)
                                  .join(', ')
                              }</span>
                            )}
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveExercise(dayIdx, exIdx)}
                          style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: 'rgba(255,255,255,0.04)',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--fg-disabled)',
                          }}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    )
                  })}

                  {/* Add exercise placeholder */}
                  <div style={{
                    padding: '10px var(--space-4)',
                    borderTop: exercises.length > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  }}>
                    <button
                      disabled
                      style={{
                        width: '100%', textAlign: 'left',
                        background: 'none', border: 'none',
                        color: 'var(--fg-disabled)',
                        fontSize: 'var(--text-xs)', cursor: 'default',
                        padding: '4px 0',
                        opacity: 0.5,
                      }}
                    >
                      {t('program.addExercise')}
                    </button>
                  </div>
                </div>
              )}
            </Glass>
          )
        })}

        {/* ── Other Programs ── */}
        {otherPrograms && otherPrograms.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: 'var(--tracking-caps)',
              textTransform: 'uppercase',
              color: 'var(--fg-tertiary)',
              marginBottom: 'var(--space-3)',
            }}>
              {t('program.otherPrograms')}
            </div>
            <Glass padding={0} style={{ overflow: 'hidden' }}>
              {otherPrograms.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => navigate('/program/' + p.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '12px var(--space-4)',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: p.isActive
                      ? 'hsla(var(--accent-h,158),40%,30%,0.4)'
                      : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: p.isActive
                      ? 'hsl(var(--accent-h,158),55%,72%)'
                      : 'var(--fg-disabled)',
                  }}>
                    <Icon name="zap" size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      color: 'var(--fg-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {p.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--fg-tertiary)',
                      marginTop: 1,
                    }}>
                      {p.durationWeeks ? t('program.daysShort', { n: p.durationWeeks * 7 }) : ''}
                      {p.isActive && (
                        <span style={{ color: 'hsl(var(--accent-h,158),55%,72%)' }}>
                          {p.durationWeeks ? ' · ' : ''}{t('program.active').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={14} style={{ color: 'var(--fg-disabled)', flexShrink: 0 }} />
                </button>
              ))}
            </Glass>
          </div>
        )}
      </div>

      {/* ── Exercise Edit BottomSheet ── */}
      <BottomSheet
        open={!!editingExercise}
        onClose={() => setEditingExercise(null)}
      >
        {editEx && (
          <>
            <div style={{
              fontSize: 'var(--text-base)', fontWeight: 600,
              color: 'var(--fg-primary)', marginBottom: 'var(--space-4)',
            }}>
              {editEx.nameRu}
            </div>

            <Stepper
              label={t('program.sets')}
              value={editEx.sets}
              min={1}
              max={10}
              onChange={v => handleUpdateExercise(editingExercise.dayIdx, editingExercise.exIdx, { sets: v })}
            />

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <Stepper
              label={t('program.reps')}
              value={editEx.repsMax}
              min={1}
              max={30}
              onChange={v => handleUpdateExercise(editingExercise.dayIdx, editingExercise.exIdx, { repsMin: v, repsMax: v })}
            />

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <Stepper
              label={t('program.rest')}
              value={editEx.restSec || 90}
              min={15}
              max={300}
              onChange={v => handleUpdateExercise(editingExercise.dayIdx, editingExercise.exIdx, { restSec: v })}
            />

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 'var(--space-4)' }} />

            <button
              onClick={() => handleRemoveExercise(editingExercise.dayIdx, editingExercise.exIdx)}
              style={{
                width: '100%', padding: '12px',
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 12,
                color: 'var(--danger, hsl(0,65%,55%))',
                fontSize: 'var(--text-sm)', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('program.removeExercise')}
            </button>
          </>
        )}
      </BottomSheet>

      {/* ── Confirm leave dialog ── */}
      <ConfirmDialog
        open={confirmLeave}
        title={t('program.unsavedTitle')}
        message={t('program.unsavedMessage')}
        confirmLabel={t('program.unsavedConfirm')}
        variant="danger"
        onConfirm={handleConfirmLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}

