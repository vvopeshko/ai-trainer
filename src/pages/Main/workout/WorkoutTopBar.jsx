import { useState, useEffect } from 'react'
import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

// ─── WorkoutTopBar (glass_v3: Glass strong, timer, progress, ГОТОВО) ────

// Чистое время тренировки в секундах (пауза вычитается).
function calcElapsed(startedAt, totalPausedMs, pausedAt) {
  const end = pausedAt ?? Date.now()
  return Math.max(0, Math.floor((end - startedAt - (totalPausedMs || 0)) / 1000))
}

// Таймер тикает ВНУТРИ топбара (как в HeroBlock): секундный setState в корне
// WorkoutPage ре-рендерил всю страницу (~1400 строк) каждую секунду тренировки.
export function WorkoutTopBar({ startedAt, pausedAt, totalPausedMs, exerciseNum, totalExercises, doneSetCount, totalSetCount, onBack, onFinish, onCancel, hasAnySets, onPause, onResume }) {
  const { t } = useTranslation()
  const paused = pausedAt != null

  const [elapsed, setElapsed] = useState(() =>
    startedAt ? calcElapsed(startedAt, totalPausedMs, pausedAt) : 0,
  )
  useEffect(() => {
    if (!startedAt || pausedAt) return
    const tick = () => setElapsed(calcElapsed(startedAt, totalPausedMs, null))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt, pausedAt, totalPausedMs])

  // На паузе показываем «замороженное» значение, не последний тик.
  const displayElapsed = startedAt && pausedAt ? calcElapsed(startedAt, totalPausedMs, pausedAt) : elapsed
  const mm = String(Math.floor(displayElapsed / 60)).padStart(1, '0')
  const ss = String(displayElapsed % 60).padStart(2, '0')

  return (
    <div style={{ position: 'relative', zIndex: 1, padding: 'calc(12px + var(--safe-top, 0px)) 12px 8px' }}>
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
          background: hasAnySets ? 'hsl(var(--accent-h,158),55%,55%)' : 'rgba(255,255,255,0.06)',
          color: hasAnySets ? '#0a1815' : 'var(--danger, hsl(0,65%,60%))',
          fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        }}>
          {hasAnySets ? t('workout.ready') : t('workout.cancel')}
        </button>
      </Glass>
    </div>
  )
}
