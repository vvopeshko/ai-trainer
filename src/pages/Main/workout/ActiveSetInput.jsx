import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { kgToLbs, lbsToKg } from '../../../utils/weightUnit.js'

// ─── ActiveSetInput (accent-tinted stepper card) ────────────────────────

export function ActiveSetInput({ exercise, unit, setOrder, plannedSets, lastWeight, lastReps, plannedReps, onDone }) {
  const { t } = useTranslation()
  const prevUnit = useRef(unit)
  const [weight, setWeight] = useState(() => {
    const raw = lastWeight ?? 0
    return unit === 'lbs' ? kgToLbs(raw) : raw
  })
  const [reps, setReps] = useState(lastReps ?? plannedReps ?? 10)

  const step = unit === 'lbs' ? 5 : 2.5
  const maxWeight = unit === 'lbs' ? 1100 : 500

  // Reset from lastWeight on exercise / data change
  useEffect(() => {
    const raw = lastWeight ?? 0
    setWeight(unit === 'lbs' ? kgToLbs(raw) : raw)
    setReps(lastReps ?? plannedReps ?? 10)
    prevUnit.current = unit
  }, [exercise.id, lastWeight, lastReps, plannedReps]) // eslint-disable-line react-hooks/exhaustive-deps

  // Convert displayed weight when unit toggles (without resetting from lastWeight)
  useEffect(() => {
    if (prevUnit.current !== unit) {
      setWeight(w => unit === 'lbs' ? kgToLbs(w) : lbsToKg(w))
      prevUnit.current = unit
    }
  }, [unit])

  const handleDone = () => {
    const weightKg = unit === 'lbs' ? lbsToKg(weight) : weight
    onDone({ weight: weightKg, reps })
  }

  const displayWeight = weight % 1 === 0 ? weight : weight.toFixed(1)

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
          <button onClick={() => setWeight(w => Math.max(0, w - step))} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {displayWeight}
            </div>
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {unit === 'lbs' ? 'lbs' : 'кг'}
            </div>
          </div>
          <button onClick={() => setWeight(w => Math.min(maxWeight, w + step))} style={{
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

      <button onClick={handleDone} style={{
        marginTop: 11, width: '100%', height: 46, borderRadius: 11, border: 'none',
        background: '#fff', color: 'hsl(var(--accent-h,158),50%,22%)',
        fontSize: 13, fontWeight: 700, letterSpacing: 0.4, cursor: 'pointer',
      }}>
        {t('workout.done').toUpperCase()} · {displayWeight} × {reps}
      </button>
    </div>
  )
}
