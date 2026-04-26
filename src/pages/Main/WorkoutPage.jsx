/**
 * Workout Page — glass_v3 redesign (BRD §12.2).
 *
 * Single scrollable screen:
 *   WorkoutTopBar (timer + progress + ГОТОВО)
 *   → Collapsed done exercises
 *   → Active exercise card (header + done sets + stepper/rest)
 *   → Upcoming exercises list
 *
 * ExercisePicker shown only for no-plan flow or "добавить другое".
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/api.js'
import TopBar from '../../components/ui/TopBar.jsx'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { RestCard } from '../../components/ui/RestCard.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import BigStepper from '../../components/ui/BigStepper.jsx'

// ─── WorkoutTopBar (glass_v3: Glass strong, timer, progress, ГОТОВО) ────

function WorkoutTopBar({ elapsed, exerciseNum, totalExercises, doneSetCount, totalSetCount, onBack, onFinish, onCancel, hasAnySets, paused, onPause, onResume }) {
  const { t } = useTranslation()
  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '12px 12px 8px' }}>
      <Glass variant="strong" padding="8px 8px 8px 6px" radius={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'rgba(255,255,255,0.04)', border: 'none',
          color: '#ECEAEF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Icon name="chevronLeft" size={17} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 21, fontWeight: 600,
            lineHeight: 1,
            color: paused ? 'var(--warning, hsl(45,80%,60%))' : 'hsl(var(--accent-h,158),55%,75%)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {mm}:{ss}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3,
          }}>
            {paused
              ? t('workout.paused')
              : totalExercises > 0
                ? `${t('workout.exerciseOf', { n: exerciseNum, total: totalExercises })} · ${t('workout.setsProgress', { done: doneSetCount, total: totalSetCount })}`
                : `${doneSetCount} ${t('workout.sets')}`
            }
          </div>
        </div>

        {/* Pause / Resume button */}
        <button onClick={paused ? onResume : onPause} style={{
          width: 32, height: 32, borderRadius: 9,
          background: paused ? 'hsla(var(--accent-h,158),55%,55%,0.15)' : 'rgba(255,255,255,0.04)',
          border: 'none',
          color: paused ? 'hsl(var(--accent-h,158),55%,75%)' : 'rgba(236,234,239,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Icon name={paused ? 'play' : 'pause'} size={14} />
        </button>

        <button onClick={hasAnySets ? onFinish : onCancel} style={{
          height: 32, padding: '0 13px', borderRadius: 9, border: 'none',
          background: hasAnySets ? 'hsl(var(--accent-h,158),55%,55%)' : 'rgba(255,255,255,0.08)',
          color: hasAnySets ? '#0a1815' : 'rgba(236,234,239,0.7)',
          fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        }}>
          {hasAnySets ? t('workout.ready') : t('workout.cancel')}
        </button>
      </Glass>
    </div>
  )
}

// ─── CollapsedExercise (done exercise row) ──────────────────────────────

function CollapsedExercise({ name, summary, expanded, onClick }) {
  return (
    <Glass padding="9px 12px" radius={expanded ? '10px 10px 0 0' : 10} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)',
      cursor: 'pointer',
      ...(expanded && { borderBottom: 'none' }),
    }} onClick={onClick}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name="check" size={12} strokeWidth={3} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: 'rgba(236,234,239,0.9)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(236,234,239,0.55)' }}>
        {summary}
      </div>
      <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={13} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}

// ─── DoneSetRow (compact done set inside active card) ───────────���───────

function DoneSetRow({ index, weight, reps, onDelete }) {
  return (
    <div style={{
      padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="check" size={11} strokeWidth={3} />
      </div>
      <div style={{
        fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        подход {index + 1}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13.5, flex: 1,
        fontWeight: 600, color: '#ECEAEF', textAlign: 'right',
      }}>
        {weight} × {reps}
      </span>
      {onDelete && (
        <button onClick={onDelete} style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', border: 'none',
          color: 'rgba(236,234,239,0.35)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  )
}

// ─── ActiveSetInput (accent-tinted stepper card) ────────────────────────

function ActiveSetInput({ exercise, setOrder, plannedSets, lastWeight, lastReps, plannedReps, onDone }) {
  const { t } = useTranslation()
  const [weight, setWeight] = useState(lastWeight ?? 0)
  const [reps, setReps] = useState(lastReps ?? plannedReps ?? 10)

  useEffect(() => {
    setWeight(lastWeight ?? 0)
    setReps(lastReps ?? plannedReps ?? 10)
  }, [exercise.id, lastWeight, lastReps, plannedReps])

  const targetLabel = plannedReps
    ? (plannedReps === (lastReps ?? plannedReps)
      ? t('workout.targetReps', { reps: plannedReps })
      : t('workout.targetReps', { reps: plannedReps }))
    : null

  return (
    <div style={{
      padding: 14, borderRadius: 13,
      background: 'hsla(var(--accent-h,158),50%,22%,0.55)',
      border: '1px solid hsla(var(--accent-h,158),55%,50%,0.32)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {plannedSets
            ? t('workout.setOf', { n: setOrder + 1, total: plannedSets })
            : t('workout.set', { n: setOrder + 1 })
          }
        </div>
        {targetLabel && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{targetLabel}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <div style={{
          padding: '7px 4px', borderRadius: 10,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => setWeight(w => Math.max(0, w - 2.5))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {weight % 1 === 0 ? weight : weight.toFixed(1)}
            </div>
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('workout.weightKg')}
            </div>
          </div>
          <button onClick={() => setWeight(w => Math.min(500, w + 2.5))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>+</button>
        </div>

        <div style={{
          padding: '7px 4px', borderRadius: 10,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => setReps(r => Math.max(1, r - 1))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#fff' }}>{reps}</div>
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              повт
            </div>
          </div>
          <button onClick={() => setReps(r => Math.min(100, r + 1))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>+</button>
        </div>
      </div>

      <button onClick={() => onDone({ weight, reps })} style={{
        marginTop: 11, width: '100%', height: 46, borderRadius: 11, border: 'none',
        background: '#fff', color: 'hsl(var(--accent-h,158),50%,22%)',
        fontSize: 13, fontWeight: 700, letterSpacing: 0.4, cursor: 'pointer',
      }}>
        {t('workout.done').toUpperCase()} · {weight % 1 === 0 ? weight : weight.toFixed(1)} × {reps}
      </button>
    </div>
  )
}

// ─── UpcomingExerciseItem ───────────────────────────────────────────────

function UpcomingExerciseItem({ index, name, scheme, expanded, hasPartial, onClick, onDragStart, isDragging, dragOffset }) {
  return (
    <Glass padding="11px 12px" radius={11} style={{
      display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
      ...(isDragging && {
        transform: `translateY(${dragOffset}px) scale(1.02)`,
        zIndex: 50, position: 'relative',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        opacity: 0.95,
      }),
      ...(!isDragging && { transition: 'transform 0.15s ease' }),
    }} onClick={isDragging ? undefined : onClick}>
      {onDragStart && (
        <div
          onTouchStart={onDragStart}
          style={{
            width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, touchAction: 'none', cursor: 'grab',
            color: 'rgba(236,234,239,0.25)', marginLeft: -4,
          }}
        >
          <Icon name="grip" size={16} />
        </div>
      )}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: hasPartial ? 'hsla(var(--accent-h,158),55%,55%,0.15)' : 'rgba(255,255,255,0.04)',
        border: hasPartial ? '1.5px solid hsla(var(--accent-h,158),55%,55%,0.5)' : '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        color: hasPartial ? 'hsl(var(--accent-h,158),55%,70%)' : 'rgba(236,234,239,0.55)',
        flexShrink: 0,
      }}>
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: '#ECEAEF',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{ fontSize: 10.5, color: 'rgba(236,234,239,0.5)', marginTop: 2 }}>{scheme}</div>
      </div>
      <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}

// ─── ExpandedUpcomingCard (active-card style with last results) ─────────

function ExpandedUpcomingCard({ planExercise, index, totalExercises, lastResults, partialSets: partial, onStart, onCollapse }) {
  const { t } = useTranslation()

  const scheme = planExercise.repsMin === planExercise.repsMax
    ? `${planExercise.sets}×${planExercise.repsMin}`
    : `${planExercise.sets}×${planExercise.repsMin}-${planExercise.repsMax}`

  return (
    <Glass radius={16} style={{ overflow: 'hidden', padding: 0 }}>
      {/* Header — like active card */}
      <div style={{ padding: '14px 14px 12px', cursor: 'pointer' }} onClick={onCollapse}>
        <div style={{
          fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'rgba(236,234,239,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{t('workout.exerciseOf', { n: index, total: totalExercises })} · {scheme}</span>
          <Icon name="chevronDown" size={13} style={{ color: 'rgba(236,234,239,0.35)' }} />
        </div>
        <div style={{
          fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginTop: 6,
          color: '#fff', fontFamily: 'var(--font-display)',
        }}>
          {planExercise.nameRu}
        </div>
        {planExercise.restSec && (
          <div style={{ fontSize: 11.5, color: 'rgba(236,234,239,0.45)', marginTop: 4 }}>
            {t('workout.restSec', { sec: planExercise.restSec })}
          </div>
        )}
      </div>

      {/* Partial progress (done sets from this session) */}
      {partial && partial.length > 0 && (
        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '2px 0 4px',
            fontSize: 9, fontWeight: 600, color: 'hsl(var(--accent-h,158),55%,70%)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {t('workout.setsProgress', { done: partial.length, total: planExercise.sets })}
          </div>
          {partial.map((s, i) => (
            <div key={i} style={{
              padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
              background: 'hsla(var(--accent-h,158),50%,22%,0.25)',
              border: '1px solid hsla(var(--accent-h,158),55%,50%,0.15)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="check" size={11} strokeWidth={3} />
              </div>
              <div style={{
                fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('workout.set', { n: i + 1 })}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13.5, flex: 1,
                fontWeight: 600, color: '#ECEAEF', textAlign: 'right',
              }}>
                {s.weightKg ?? 0} × {s.reps}
              </span>
            </div>
          ))}
          {/* Remaining planned sets */}
          {Array.from({ length: planExercise.sets - partial.length }, (_, i) => {
            const setNum = partial.length + 1 + i
            const repsLabel = planExercise.repsMin === planExercise.repsMax
              ? `${planExercise.repsMin}`
              : `${planExercise.repsMin}–${planExercise.repsMax}`
            return (
              <div key={`p${i}`} style={{
                padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
                border: '1px dashed rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '1.5px dashed rgba(255,255,255,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: 'rgba(236,234,239,0.25)',
                }}>
                  {setNum}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.25)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t('workout.set', { n: setNum })}
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1,
                  color: 'rgba(236,234,239,0.2)', textAlign: 'right',
                }}>
                  {repsLabel} {t('workout.reps').toLowerCase()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Last results as set rows */}
      {!partial && (
        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lastResults?.lastSets ? (
            <>
              <div style={{
                padding: '2px 0 4px',
                fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('workout.lastTime')}
              </div>
              {lastResults.lastSets.map((s, i) => (
                <div key={i} style={{
                  padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {t('workout.set', { n: i + 1 })}
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13.5, flex: 1,
                    fontWeight: 600, color: 'rgba(236,234,239,0.7)', textAlign: 'right',
                  }}>
                    {s.weightKg ?? 0} × {s.reps}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div style={{
              padding: '6px 0', fontSize: 10.5, color: 'rgba(236,234,239,0.35)', fontStyle: 'italic',
            }}>
              {t('workout.noHistory')}
            </div>
          )}
        </div>
      )}

      {/* Start / Continue button */}
      <div style={{ padding: '12px 12px 14px' }}>
        <button onClick={onStart} style={{
          width: '100%', height: 46, borderRadius: 11, border: 'none',
          background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="play" size={14} />
          {partial ? t('home.continueWorkout') : t('workout.startExercise')}
        </button>
      </div>
    </Glass>
  )
}

// ─── WorkoutSkeleton (loading state while checkActive runs) ─────────────

function WorkoutSkeleton() {
  return (
    <div style={{ background: '#08080B', minHeight: '100vh' }}>
      {/* TopBar skeleton */}
      <div style={{ padding: '12px 12px 8px' }}>
        <Glass variant="strong" padding="8px 8px 8px 6px" radius={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width={32} height={32} radius={9} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={60} height={20} radius={4} />
            <Skeleton width={100} height={9} />
          </div>
          <Skeleton width={32} height={32} radius={9} />
          <Skeleton width={65} height={32} radius={9} />
        </Glass>
      </div>

      <div style={{ padding: '4px 12px 22px' }}>
        {/* Active exercise card skeleton */}
        <Glass radius={16} style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="35%" height={10} />
            <Skeleton width="65%" height={20} />
            <Skeleton width="20%" height={11} />
          </div>
          <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Stepper skeleton */}
            <div style={{
              padding: 14, borderRadius: 13,
              background: 'hsla(var(--accent-h,158),50%,22%,0.25)',
              border: '1px solid hsla(var(--accent-h,158),55%,50%,0.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 11 }}>
                <Skeleton width="30%" height={10} />
                <Skeleton width="20%" height={10} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <Skeleton height={50} radius={10} />
                <Skeleton height={50} radius={10} />
              </div>
              <Skeleton height={46} radius={11} style={{ marginTop: 11 }} />
            </div>
          </div>
        </Glass>

        {/* Upcoming exercises skeleton */}
        <div style={{ marginTop: 18, marginBottom: 6, padding: '0 4px' }}>
          <Skeleton width="25%" height={10} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <Glass key={i} padding="11px 12px" radius={11} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Skeleton width={28} height={28} radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Skeleton width="55%" height={13} />
                <Skeleton width="25%" height={10} />
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ExercisePicker ─────────────────────────────────────────────────────

function ExercisePicker({ onSelect }) {
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

// ─── Main WorkoutPage ───────────────────────────────────────────────────

export default function WorkoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [workoutId, setWorkoutId] = useState(null)
  const [currentExercise, setCurrentExercise] = useState(null)
  const [doneSets, setDoneSets] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [startedAt, setStartedAt] = useState(null)
  const [resting, setResting] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [totalPausedMs, setTotalPausedMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedExerciseId, setExpandedExerciseId] = useState(null)
  const [expandedDoneIndex, setExpandedDoneIndex] = useState(null)
  const [lastResultsCache, setLastResultsCache] = useState({})
  const [partialSets, setPartialSets] = useState({}) // { exerciseId: [...sets] }

  // Plan state
  const [planExercises, setPlanExercises] = useState(null)
  const [planDayTitle, setPlanDayTitle] = useState(null)
  const [planIndex, setPlanIndex] = useState(0)

  const hasPlan = planExercises && planExercises.length > 0

  // ── Drag reorder state ──
  const [draggingId, setDraggingId] = useState(null)
  const [dragDelta, setDragDelta] = useState(0)
  const dragInfo = useRef({ startY: 0, lastSwapDelta: 0, itemHeight: 62 })
  const planExRef = useRef(planExercises)
  planExRef.current = planExercises
  const currentExRef = useRef(currentExercise)
  currentExRef.current = currentExercise
  const doneExIdsRef = useRef(new Set())

  useEffect(() => {
    doneExIdsRef.current = new Set(allExercises.map(e => e.exercise.id))
  }, [allExercises])

  const handleDragStart = (e, exerciseId) => {
    const touch = e.touches[0]
    const itemEl = e.currentTarget.closest('[data-drag-item]')
    const h = itemEl?.getBoundingClientRect().height ?? 55
    dragInfo.current = { startY: touch.clientY, lastSwapDelta: 0, itemHeight: h + 6 }
    setDraggingId(exerciseId)
    setDragDelta(0)
    setExpandedExerciseId(null)
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium') } catch {}
  }

  useEffect(() => {
    if (!draggingId) return

    const onMove = (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      const delta = touch.clientY - dragInfo.current.startY
      setDragDelta(delta)

      const { itemHeight, lastSwapDelta } = dragInfo.current
      const netDelta = delta - lastSwapDelta

      if (Math.abs(netDelta) > itemHeight * 0.5) {
        const direction = netDelta > 0 ? 'down' : 'up'
        const plan = planExRef.current
        const curEx = currentExRef.current
        const doneIds = doneExIdsRef.current
        const upcoming = plan.filter(pe => pe.exerciseId !== curEx?.id && !doneIds.has(pe.exerciseId))
        const idx = upcoming.findIndex(pe => pe.exerciseId === draggingId)
        const swapIdx = direction === 'down' ? idx + 1 : idx - 1

        if (idx >= 0 && swapIdx >= 0 && swapIdx < upcoming.length) {
          const idxA = plan.findIndex(pe => pe.exerciseId === upcoming[idx].exerciseId)
          const idxB = plan.findIndex(pe => pe.exerciseId === upcoming[swapIdx].exerciseId)
          const next = [...plan]
          ;[next[idxA], next[idxB]] = [next[idxB], next[idxA]]
          setPlanExercises(next)
          planExRef.current = next
          dragInfo.current.lastSwapDelta += direction === 'down' ? itemHeight : -itemHeight
          try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {}
        }
      }
    }

    const onEnd = () => {
      setDraggingId(null)
      setDragDelta(0)
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [draggingId])

  // ── Timer (accounts for pause) ──
  useEffect(() => {
    if (!startedAt || pausedAt) return
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt - totalPausedMs) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt, pausedAt, totalPausedMs])

  // ── Mount: check active workout ──
  useEffect(() => {
    let cancelled = false
    async function checkActive() {
      try {
        const data = await apiGet('/api/v1/workouts/active')
        if (cancelled) return
        if (!data.workout) { setPicking(true); setLoading(false); return }

        const workout = data.workout
        setWorkoutId(workout.id)
        setStartedAt(new Date(workout.startedAt).getTime())
        setTotalPausedMs(workout.totalPausedMs || 0)
        if (workout.pausedAt) setPausedAt(new Date(workout.pausedAt).getTime())

        if (data.planExercises) {
          setPlanExercises(data.planExercises)
          setPlanDayTitle(data.planDayTitle)

          // Batch-fetch last results for all plan exercises
          const ids = data.planExercises.map(pe => pe.exerciseId)
          apiPost('/api/v1/exercises/batch-last-results', { exerciseIds: ids })
            .then(r => { if (!cancelled) setLastResultsCache(r.results) })
            .catch(() => {})
        }

        if (workout.sets?.length > 0) {
          const grouped = {}
          const order = []
          for (const s of workout.sets) {
            if (!grouped[s.exerciseId]) {
              grouped[s.exerciseId] = { exercise: s.exercise, sets: [] }
              order.push(s.exerciseId)
            }
            grouped[s.exerciseId].sets.push(s)
          }
          setAllExercises(order.map(id => grouped[id]))

          if (data.planExercises) {
            const doneIds = new Set(order)
            const nextIdx = data.planExercises.findIndex(pe => !doneIds.has(pe.exerciseId))
            if (nextIdx >= 0) {
              setPlanIndex(nextIdx)
              setCurrentExercise({ id: data.planExercises[nextIdx].exerciseId, nameRu: data.planExercises[nextIdx].nameRu })
            } else {
              setPlanIndex(data.planExercises.length)
            }
          }
        } else if (data.planExercises) {
          // Fresh start with plan — auto-select first exercise
          const first = data.planExercises[0]
          setPlanIndex(0)
          setCurrentExercise({ id: first.exerciseId, nameRu: first.nameRu })
        } else {
          setPicking(true)
        }
      } catch {
        setPicking(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    checkActive()
    return () => { cancelled = true }
  }, [])

  // ── Ensure workout exists ──
  const ensureWorkout = async () => {
    if (workoutId) return workoutId
    const { workout } = await apiPost('/api/v1/workouts', {})
    setWorkoutId(workout.id)
    setStartedAt(new Date(workout.startedAt).getTime())
    return workout.id
  }

  // ── Computed ──
  const doneExerciseIds = new Set(allExercises.map(e => e.exercise.id))
  const partialSetCount = Object.values(partialSets).reduce((s, sets) => s + sets.length, 0)
  const hasAnySets = allExercises.length > 0 || doneSets.length > 0 || partialSetCount > 0
  const totalDoneSets = allExercises.reduce((s, e) => s + e.sets.length, 0) + doneSets.length + partialSetCount
  const totalPlannedSets = hasPlan ? planExercises.reduce((s, e) => s + e.sets, 0) : 0
  const currentExerciseNum = allExercises.length + (currentExercise ? 1 : 0)
  const currentPlanExercise = hasPlan && planIndex < planExercises.length ? planExercises[planIndex] : null

  // ── Handlers ──

  const saveCurrentExercise = () => {
    if (!currentExercise || doneSets.length === 0) return
    const curPlan = planExercises?.find(pe => pe.exerciseId === currentExercise.id)
    if (curPlan && doneSets.length < curPlan.sets) {
      // Partial — keep in upcoming so user can return
      setPartialSets(prev => ({ ...prev, [currentExercise.id]: [...doneSets] }))
    } else {
      // Complete or no plan — move to done
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }
  }

  const handleSelectFromPlan = (planEx) => {
    saveCurrentExercise()

    const idx = planExercises.findIndex(pe => pe.exerciseId === planEx.exerciseId)
    if (idx >= 0) setPlanIndex(idx)
    setCurrentExercise({ id: planEx.exerciseId, nameRu: planEx.nameRu })

    // Restore partial progress if any
    const partial = partialSets[planEx.exerciseId]
    if (partial) {
      setDoneSets(partial)
      setPartialSets(prev => { const next = { ...prev }; delete next[planEx.exerciseId]; return next })
    } else {
      setDoneSets([])
    }
    setResting(false)
    setPicking(false)
  }

  const handleSelectExercise = async (exercise) => {
    try { await ensureWorkout() } catch (err) {
      console.error('Failed to create workout:', err); return
    }
    saveCurrentExercise()
    setCurrentExercise(exercise)
    setDoneSets([])
    setResting(false)
    setPicking(false)
  }

  const handleSetDone = async ({ weight, reps }) => {
    if (!workoutId || !currentExercise) return

    const newSet = { weightKg: weight, reps, exerciseId: currentExercise.id }
    const updatedSets = [...doneSets, newSet]
    setDoneSets(updatedSets)

    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}

    // Always show rest timer (including after last set)
    setResting(true)

    // API call in background — save set.id for potential deletion
    try {
      const { set } = await apiPost(`/api/v1/workouts/${workoutId}/sets`, {
        exerciseId: currentExercise.id,
        exerciseOrder: allExercises.length,
        setOrder: doneSets.length,
        weightKg: weight || null,
        reps,
      })
      // Patch the optimistic entry with server id
      setDoneSets(prev => prev.map((s, i) =>
        i === prev.length - 1 && !s.id ? { ...s, id: set.id } : s
      ))
    } catch (err) {
      console.error('Failed to log set:', err)
    }
  }

  const handleRestComplete = () => {
    setResting(false)
    // Auto-advance to next exercise if all planned sets done
    const plannedSets = currentPlanExercise?.sets
    if (plannedSets && doneSets.length >= plannedSets) {
      handleNextExercise()
    }
  }

  // ── Delete handlers ──

  const handleDeleteDoneSet = (exerciseIndex, setIndex) => {
    const item = allExercises[exerciseIndex]
    const set = item.sets[setIndex]
    if (set?.id && workoutId) {
      apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
    }
    setAllExercises(prev => {
      const updated = [...prev]
      const newSets = [...updated[exerciseIndex].sets]
      newSets.splice(setIndex, 1)
      if (newSets.length === 0) {
        updated.splice(exerciseIndex, 1)
        setExpandedDoneIndex(null)
      } else {
        updated[exerciseIndex] = { ...updated[exerciseIndex], sets: newSets }
      }
      return updated
    })
  }

  const handleCancelExercise = (exerciseIndex) => {
    const item = allExercises[exerciseIndex]
    // Delete all sets in background
    if (workoutId) {
      for (const set of item.sets) {
        if (set?.id) apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
      }
    }
    setAllExercises(prev => prev.filter((_, i) => i !== exerciseIndex))
    setExpandedDoneIndex(null)
  }

  const handleDeleteCurrentSet = (setIndex) => {
    const set = doneSets[setIndex]
    if (set?.id && workoutId) {
      apiDelete(`/api/v1/workouts/${workoutId}/sets/${set.id}`).catch(() => {})
    }
    setDoneSets(prev => prev.filter((_, i) => i !== setIndex))
  }

  const handleNextExercise = (setsOverride) => {
    const sets = setsOverride || doneSets
    if (currentExercise && sets.length > 0) {
      // Explicit advance — always move to done, clear partial if any
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...sets] }])
      setPartialSets(prev => {
        if (!prev[currentExercise.id]) return prev
        const next = { ...prev }; delete next[currentExercise.id]; return next
      })
    }
    setCurrentExercise(null)
    setDoneSets([])
    setResting(false)

    if (hasPlan) {
      const updatedDoneIds = new Set([...doneExerciseIds])
      if (currentExercise) updatedDoneIds.add(currentExercise.id)

      const nextIdx = planExercises.findIndex(pe =>
        !updatedDoneIds.has(pe.exerciseId) && !partialSets[pe.exerciseId]
      )
      if (nextIdx >= 0) {
        const next = planExercises[nextIdx]
        setPlanIndex(nextIdx)
        setCurrentExercise({ id: next.exerciseId, nameRu: next.nameRu })
        return
      }
      // Check if there are only partial exercises left
      const hasOnlyPartial = planExercises.some(pe =>
        !updatedDoneIds.has(pe.exerciseId) && partialSets[pe.exerciseId]
      )
      if (hasOnlyPartial) {
        // Pick first partial to continue
        const nextPartial = planExercises.find(pe =>
          !updatedDoneIds.has(pe.exerciseId) && partialSets[pe.exerciseId]
        )
        const idx = planExercises.indexOf(nextPartial)
        setPlanIndex(idx)
        setCurrentExercise({ id: nextPartial.exerciseId, nameRu: nextPartial.nameRu })
        const restored = partialSets[nextPartial.exerciseId]
        setDoneSets(restored)
        setPartialSets(prev => { const n = { ...prev }; delete n[nextPartial.exerciseId]; return n })
        return
      }
      setPlanIndex(planExercises.length)
    } else {
      setPicking(true)
    }
  }

  const handlePause = async () => {
    if (!workoutId || pausedAt) return
    const now = Date.now()
    setPausedAt(now)
    setElapsedSec(Math.max(0, Math.floor((now - startedAt - totalPausedMs) / 1000)))
    apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'pause' })
      .catch(err => console.error('Failed to pause workout:', err))
  }

  const handleResume = async () => {
    if (!workoutId || !pausedAt) return
    const pauseDuration = Date.now() - pausedAt
    setTotalPausedMs(prev => prev + pauseDuration)
    setPausedAt(null)
    try { await apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'resume' }) }
    catch { /* optimistic update already applied */ }
  }

  const handleFinish = async () => {
    if (!workoutId) return
    setFinishing(true)

    // Save current exercise sets if any
    if (currentExercise && doneSets.length > 0) {
      setAllExercises(prev => [...prev, { exercise: currentExercise, sets: [...doneSets] }])
    }

    const totalSets = allExercises.reduce((sum, ex) => sum + ex.sets.length, 0) + doneSets.length + partialSetCount
    const totalExercises = allExercises.length + (doneSets.length > 0 ? 1 : 0) + Object.keys(partialSets).length

    try {
      const result = await apiPatch(`/api/v1/workouts/${workoutId}`, { action: 'finish' })
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}

      if (result.deleted) { navigate('/'); return }

      navigate(`/summary/${workoutId}`, {
        state: { totalSets, totalExercises, elapsedSec },
      })
    } catch (err) {
      console.error('Failed to finish workout:', err)
      setFinishing(false)
    }
  }

  const handleCancel = async () => {
    if (workoutId) {
      try { await apiPatch(`/api/v1/workouts/${workoutId}`, {}) } catch {}
    }
    navigate('/')
  }

  const handleCancelWorkout = async () => {
    setConfirmCancel(false)
    if (workoutId) {
      try { await apiDelete(`/api/v1/workouts/${workoutId}`) } catch {}
    }
    navigate('/')
  }

  const handleBack = () => {
    if (hasAnySets) {
      setConfirmCancel(true)
    } else {
      handleCancel()
    }
  }

  // ── Helper ──
  function exerciseScheme(pe) {
    return pe.repsMin === pe.repsMax
      ? `${pe.sets}×${pe.repsMin}`
      : `${pe.sets}×${pe.repsMin}-${pe.repsMax}`
  }

  function exerciseSummary(sets) {
    if (sets.length === 0) return ''
    const count = sets.length
    const reps = sets.map(s => s.reps)
    const allSame = reps.every(r => r === reps[0])
    return allSame ? `${count}×${reps[0]}` : sets.map(s => `${s.weightKg ?? 0}×${s.reps}`).join(' ')
  }

  // ── Render: Loading skeleton ──
  if (loading) return <WorkoutSkeleton />

  // ── Render: ExercisePicker (full-screen) ──
  if (picking) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
        <TopBar
          title={t('workout.selectExercise')}
          onBack={hasPlan ? () => setPicking(false) : handleBack}
          rightLabel={hasAnySets ? t('workout.finish') : workoutId ? t('workout.cancel') : undefined}
          onRight={hasAnySets ? handleFinish : workoutId ? handleCancel : undefined}
        />
        <ExercisePicker onSelect={handleSelectExercise} />
      </div>
    )
  }

  // ── Render: Main workout screen ──
  const upcomingExercises = hasPlan
    ? planExercises.filter((pe) => pe.exerciseId !== currentExercise?.id && !doneExerciseIds.has(pe.exerciseId))
    : []

  return (
    <div style={{ background: '#08080B', minHeight: '100vh' }}>
      {/* WorkoutTopBar */}
      <WorkoutTopBar
        elapsed={elapsedSec}
        exerciseNum={currentExerciseNum}
        totalExercises={hasPlan ? planExercises.length : 0}
        doneSetCount={totalDoneSets}
        totalSetCount={totalPlannedSets}
        onBack={handleBack}
        onFinish={handleFinish}
        onCancel={handleCancel}
        hasAnySets={hasAnySets}
        paused={!!pausedAt}
        onPause={handlePause}
        onResume={handleResume}
      />

      <div style={{ position: 'relative', zIndex: 1, overflow: 'auto', padding: '4px 12px 22px' }}>

        {/* ── Collapsed done exercises ── */}
        {allExercises.length > 0 && (
          <>
            <div style={{ padding: '2px 4px 6px' }}>
              <div style={{
                fontSize: 10, fontWeight: 500, color: 'rgba(236,234,239,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('workout.doneLabel')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
              {allExercises.map((item, i) => {
                const isExpanded = expandedDoneIndex === i
                return (
                  <div key={i}>
                    <CollapsedExercise
                      name={item.exercise.nameRu}
                      summary={exerciseSummary(item.sets)}
                      expanded={isExpanded}
                      onClick={() => setExpandedDoneIndex(isExpanded ? null : i)}
                    />
                    {isExpanded && (
                      <Glass padding="0" radius="0 0 10px 10px" style={{ borderTop: 'none', marginTop: -1 }}>
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {item.sets.map((s, si) => (
                            <DoneSetRow
                              key={si}
                              index={si}
                              weight={s.weightKg ?? 0}
                              reps={s.reps}
                              onDelete={() => handleDeleteDoneSet(i, si)}
                            />
                          ))}
                        </div>
                        <div style={{ padding: '6px 10px 10px' }}>
                          <button onClick={() => handleCancelExercise(i)} style={{
                            width: '100%', height: 34, borderRadius: 8, border: 'none',
                            background: 'rgba(255,80,80,0.08)',
                            color: 'var(--danger, #f87171)', fontSize: 11.5, fontWeight: 600,
                            cursor: 'pointer',
                          }}>
                            {t('workout.cancelExercise')}
                          </button>
                        </div>
                      </Glass>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Active exercise card ── */}
        {currentExercise && (
          <Glass radius={16} style={{ overflow: 'hidden', padding: 0 }}>
            {/* Header */}
            <div style={{ padding: '14px 14px 12px' }}>
              <div style={{
                fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: 'hsl(var(--accent-h,158),55%,75%)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'hsl(var(--accent-h,158),65%,60%)',
                  boxShadow: '0 0 6px hsla(var(--accent-h,158),65%,60%,0.7)',
                }} />
                {t('workout.now')} · {hasPlan
                  ? t('workout.exerciseOf', { n: planIndex + 1, total: planExercises.length })
                  : `упр ${currentExerciseNum}`
                }
              </div>
              <div style={{
                fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginTop: 6,
                color: '#fff', fontFamily: 'var(--font-display)',
              }}>
                {currentExercise.nameRu}
              </div>
              {currentPlanExercise && (
                <div style={{ fontSize: 11.5, color: 'rgba(236,234,239,0.55)', marginTop: 4 }}>
                  {exerciseScheme(currentPlanExercise)}
                </div>
              )}
            </div>

            {/* Done sets inline */}
            {doneSets.length > 0 && (
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {doneSets.map((s, i) => (
                  <DoneSetRow key={i} index={i} weight={s.weightKg ?? 0} reps={s.reps}
                    onDelete={() => handleDeleteCurrentSet(i)} />
                ))}
              </div>
            )}

            {/* Pause overlay */}
            {pausedAt && (
              <div
                onClick={handleResume}
                style={{
                  margin: '0 12px 8px',
                  padding: '20px 14px',
                  borderRadius: 13,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="pause" size={24} style={{ color: 'var(--warning, hsl(45,80%,60%))', marginBottom: 8 }} />
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)',
                  marginBottom: 4,
                }}>
                  {t('workout.paused')}
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--fg-tertiary)',
                }}>
                  {t('workout.tapToResume')}
                </div>
              </div>
            )}

            {/* Active set input OR rest timer */}
            <div style={{ padding: '12px 12px 14px', ...(pausedAt && { opacity: 0.25, pointerEvents: 'none' }) }}>
              {resting ? (
                <>
                  <RestCard
                    seconds={currentPlanExercise?.restSec || 90}
                    onSkip={handleRestComplete}
                    onComplete={handleRestComplete}
                  />
                  {/* Next set preview */}
                  {currentPlanExercise && doneSets.length < currentPlanExercise.sets && (
                    <div style={{
                      marginTop: 9, padding: '9px 12px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.45)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {t('workout.upcoming')} · {t('workout.set', { n: doneSets.length + 1 })}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1,
                        fontWeight: 600, color: 'rgba(236,234,239,0.7)', textAlign: 'right',
                      }}>
                        {doneSets.length > 0 ? `${doneSets[doneSets.length - 1].weightKg ?? 0} × ${doneSets[doneSets.length - 1].reps}` : ''}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <ActiveSetInput
                  exercise={currentExercise}
                  setOrder={doneSets.length}
                  plannedSets={currentPlanExercise?.sets || null}
                  lastWeight={doneSets.length > 0 ? doneSets[doneSets.length - 1].weightKg : null}
                  lastReps={doneSets.length > 0 ? doneSets[doneSets.length - 1].reps : null}
                  plannedReps={currentPlanExercise?.repsMin || null}
                  onDone={handleSetDone}
                />
              )}

              {/* Pending sets preview */}
              {currentPlanExercise && doneSets.length + 1 < currentPlanExercise.sets && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {Array.from({ length: currentPlanExercise.sets - doneSets.length - 1 }, (_, i) => {
                    const setNum = doneSets.length + 2 + i
                    const repsLabel = currentPlanExercise.repsMin === currentPlanExercise.repsMax
                      ? `${currentPlanExercise.repsMin}`
                      : `${currentPlanExercise.repsMin}–${currentPlanExercise.repsMax}`
                    return (
                      <div key={i} style={{
                        padding: '9px 12px', borderRadius: 10,
                        border: '1px dashed rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: '1.5px dashed rgba(255,255,255,0.10)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 600, color: 'rgba(236,234,239,0.25)',
                        }}>
                          {setNum}
                        </div>
                        <div style={{
                          fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.25)',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {t('workout.set', { n: setNum })}
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1,
                          color: 'rgba(236,234,239,0.2)', textAlign: 'right',
                        }}>
                          {repsLabel} {t('workout.reps').toLowerCase()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* + добавить подход (when all planned done but user wants more) */}
              {!resting && currentPlanExercise && doneSets.length >= currentPlanExercise.sets && (
                <button style={{
                  marginTop: 8, width: '100%', height: 36,
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)',
                  borderRadius: 10, color: 'rgba(236,234,239,0.5)', fontSize: 11.5, cursor: 'pointer',
                }}>
                  {t('workout.addSetExtra')}
                </button>
              )}
            </div>

            {/* Next exercise button (when sets done but user hasn't auto-advanced) */}
            {doneSets.length > 0 && !resting && (
              <div style={{ padding: '0 12px 14px' }}>
                <button onClick={() => handleNextExercise()} style={{
                  width: '100%', height: 40, borderRadius: 10, border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(236,234,239,0.8)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name="arrowRight" size={14} />
                  {t('workout.nextExercise')}
                </button>
              </div>
            )}
          </Glass>
        )}

        {/* ── No current exercise: all done or waiting ── */}
        {!currentExercise && hasPlan && upcomingExercises.length === 0 && (
          <Glass padding="20px" radius={16} style={{ textAlign: 'center' }}>
            <Icon name="check" size={32} style={{ color: 'hsl(var(--accent-h,158),55%,55%)' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 8 }}>
              {t('workout.completed')}
            </div>
            <Button variant="primary" block size="lg" loading={finishing} onClick={handleFinish} style={{ marginTop: 16 }}>
              {t('workout.finishWorkout')}
            </Button>
            <button onClick={() => setPicking(true)} style={{
              marginTop: 8, width: '100%', height: 36, background: 'none', border: 'none',
              color: 'rgba(236,234,239,0.5)', fontSize: 12, cursor: 'pointer',
            }}>
              {t('workout.addOther')}
            </button>
          </Glass>
        )}

        {/* ── Upcoming exercises ── */}
        {upcomingExercises.length > 0 && (
          <>
            <div style={{ marginTop: 18, marginBottom: 6, padding: '0 4px' }}>
              <div style={{
                fontSize: 10, fontWeight: 500, color: 'rgba(236,234,239,0.45)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('workout.upcoming')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingExercises.map((pe) => {
                const isExpanded = expandedExerciseId === pe.exerciseId
                const peIndex = planExercises.indexOf(pe) + 1
                const isDragging = draggingId === pe.exerciseId
                const canDrag = upcomingExercises.length > 1
                const partial = partialSets[pe.exerciseId]
                const scheme = partial
                  ? t('workout.setsProgress', { done: partial.length, total: pe.sets })
                  : exerciseScheme(pe)
                return (
                  <div key={pe.exerciseId} data-drag-item>
                    {isExpanded && !draggingId ? (
                      <ExpandedUpcomingCard
                        planExercise={pe}
                        index={peIndex}
                        totalExercises={planExercises.length}
                        lastResults={lastResultsCache[pe.exerciseId]}
                        partialSets={partial}
                        onCollapse={() => setExpandedExerciseId(null)}
                        onStart={() => {
                          setExpandedExerciseId(null)
                          handleSelectFromPlan(pe)
                        }}
                      />
                    ) : (
                      <UpcomingExerciseItem
                        index={peIndex}
                        name={pe.nameRu}
                        scheme={scheme}
                        expanded={false}
                        hasPartial={!!partial}
                        onClick={() => setExpandedExerciseId(pe.exerciseId)}
                        onDragStart={canDrag ? (e) => handleDragStart(e, pe.exerciseId) : null}
                        isDragging={isDragging}
                        dragOffset={isDragging ? dragDelta - dragInfo.current.lastSwapDelta : 0}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Add other exercise button ── */}
        {hasPlan && currentExercise && (
          <button onClick={() => setPicking(true)} style={{
            marginTop: 14, width: '100%', height: 36,
            background: 'none', border: 'none',
            color: 'rgba(236,234,239,0.5)', fontSize: 11.5, cursor: 'pointer',
          }}>
            {t('workout.addOther')}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={t('workout.cancelWorkoutTitle')}
        message={t('workout.cancelWorkoutMessage')}
        confirmLabel={t('workout.cancelWorkoutConfirm')}
        variant="danger"
        onConfirm={handleCancelWorkout}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
