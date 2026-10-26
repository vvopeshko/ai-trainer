import { restElapsedSeconds } from '../../utils/workoutState.js'
import { useState, useEffect } from 'react'
import { Glass } from './Glass.jsx'
import { Icon } from './Icon.jsx'
import { useTranslation } from '../../i18n/useTranslation.js'

/**
 * Rest timer between sets. Counts UP to show elapsed rest time.
 * Shows recommended rest as reference. "Идём дальше" button to continue.
 */
export function RestCard({ seconds = 90, onSkip, startedAt, pausedAt = null }) {
  const { t: tr } = useTranslation()
  const [fallbackStart] = useState(Date.now)
  const start = startedAt ?? fallbackStart
  const [elapsed, setElapsed] = useState(() => restElapsedSeconds(start, pausedAt))

  useEffect(() => {
    const tick = () => setElapsed(restElapsedSeconds(start, pausedAt))
    tick()
    const id = setInterval(tick, 1000)
    // Catch up after app was in background
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [start, pausedAt])

  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, '0')
  const pct = Math.min(100, (elapsed / seconds) * 100)
  const isReady = elapsed >= seconds

  return (
    <>
      <style>{`
        @keyframes trainerRestBreath { 0%,100% { opacity:.55; transform: scale(1); } 50% { opacity:.85; transform: scale(1.04); } }
        @keyframes restCardAppear { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <Glass flat variant="tint" padding="18px 16px 16px" radius={16} style={{
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        animation: 'restCardAppear 0.35s var(--ease-out) both',
      }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, hsla(var(--accent-h,158),55%,40%,0.4) 0%, transparent 65%)',
          // Три «вдоха» и покой: бесконечная анимация держала композитинг
          // всё время отдыха (минуты) — заметно на слабых Android
          animation: 'trainerRestBreath 3s ease-in-out 3',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            fontSize: 'var(--text-xs)', fontWeight: 700,
            color: isReady ? 'hsl(var(--accent-h,158),55%,75%)' : 'hsl(var(--accent-h,158),50%,82%)',
            letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <Icon name="pause" size={10} /> {tr('workout.rest')}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-display)', fontWeight: 700,
            color: isReady ? 'hsl(var(--accent-h,158),55%,75%)' : '#fff',
            marginTop: 4, letterSpacing: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>{mm}:{ss}</div>
          <div style={{ margin: '10px auto 0', width: '70%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{
              // scaleX, а не width: трансформация идёт на композиторе, без layout каждую секунду
              height: '100%', width: '100%', borderRadius: 2,
              transform: `scaleX(${pct / 100})`, transformOrigin: 'left', transition: 'transform 1s linear',
              background: isReady ? 'hsl(var(--accent-h,158),55%,65%)' : '#fff',
            }} />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
            {tr('workout.restRecommended', { sec: seconds })}
          </div>
          {onSkip && (
            <button onClick={onSkip} style={{
              marginTop: 12, height: 36, padding: '0 18px', borderRadius: 10,
              background: isReady ? 'hsl(var(--accent-h,158),55%,55%)' : 'rgba(255,255,255,0.14)',
              border: isReady ? 'none' : '1px solid rgba(255,255,255,0.18)',
              color: isReady ? '#0a1815' : '#fff',
              fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
            }}>{tr('workout.letsGo')}</button>
          )}
        </div>
      </Glass>
    </>
  )
}
