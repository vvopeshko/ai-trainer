import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'
import { DoneSetRow } from './DoneSetRow.jsx'

// ─── ExpandedUpcomingCard (active-card style with last results) ─────────

export function ExpandedUpcomingCard({ planExercise, index, totalExercises, lastResults, partialSets: partial, onStart, onCollapse, onDeletePartialSet, onSwapAlternative, onInfo }) {
  const { t } = useTranslation()

  const scheme = planExercise.repsMin === planExercise.repsMax
    ? `${planExercise.sets}×${planExercise.repsMin}`
    : `${planExercise.sets}×${planExercise.repsMin}-${planExercise.repsMax}`

  const alts = planExercise.alternatives || []

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
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
        }}>
          <div style={{
            fontSize: 20, fontWeight: 600, lineHeight: 1.15,
            color: '#fff', fontFamily: 'var(--font-display)',
            flex: 1, minWidth: 0,
          }}>
            {planExercise.nameRu}
          </div>
          {onInfo && (
            <button
              onClick={(e) => { e.stopPropagation(); onInfo(planExercise.exerciseId) }}
              style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: 'rgba(255,255,255,0.06)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(236,234,239,0.5)',
              }}
            >
              <Icon name="info" size={14} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(236,234,239,0.45)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          {planExercise.restSec && (
            <span>{t('workout.restSec', { sec: planExercise.restSec })}</span>
          )}
          {alts.length > 0 && (
            <span style={{
              padding: '1px 6px', borderRadius: 5,
              background: 'hsla(var(--accent-h,158),55%,55%,0.12)',
              color: 'hsl(var(--accent-h,158),55%,70%)',
              fontSize: 10, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="swap" size={9} />
              {t('workout.alternatives', { count: alts.length })}
            </span>
          )}
        </div>
      </div>

      {/* Alternatives swap buttons */}
      {alts.length > 0 && onSwapAlternative && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {alts.map(alt => (
            <button key={alt.exerciseId} onClick={(e) => { e.stopPropagation(); onSwapAlternative(planExercise, alt) }} style={{
              padding: '8px 12px', borderRadius: 10, border: 'none',
              background: 'hsla(var(--accent-h,158),55%,55%,0.08)',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              fontFamily: 'var(--font-sans)',
            }}>
              <Icon name="swap" size={12} style={{ color: 'hsl(var(--accent-h,158),55%,70%)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--accent-h,158),55%,70%)', flex: 1 }}>
                {alt.nameRu}
              </span>
            </button>
          ))}
        </div>
      )}

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
            <DoneSetRow
              key={i}
              index={i}
              weight={s.weightKg ?? 0}
              reps={s.reps}
              onDelete={onDeletePartialSet ? () => onDeletePartialSet(i) : null}
            />
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
