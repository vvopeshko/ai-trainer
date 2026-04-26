import { useState, useEffect } from 'react'
import { Glass } from './Glass.jsx'
import { Icon } from './Icon.jsx'
import { useTranslation } from '../../i18n/useTranslation.js'

/**
 * Rest timer between sets. Breathing radial background, mm:ss countdown,
 * progress bar, breathing instruction, skip button.
 */
export function RestCard({ seconds = 90, onSkip, onComplete }) {
  const { t: tr } = useTranslation()
  const [t, setT] = useState(seconds)

  useEffect(() => {
    if (t <= 0) { onComplete?.(); return }
    const id = setInterval(() => setT(x => x - 1), 1000)
    return () => clearInterval(id)
  }, [t, onComplete])

  const mm = Math.floor(t / 60)
  const ss = String(t % 60).padStart(2, '0')
  const pct = ((seconds - t) / seconds) * 100

  return (
    <>
      <style>{`@keyframes trainerRestBreath { 0%,100% { opacity:.55; transform: scale(1); } 50% { opacity:.85; transform: scale(1.04); } }`}</style>
      <Glass variant="tint" padding="18px 16px 16px" radius={16} style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, hsla(var(--accent-h,158),55%,40%,0.4) 0%, transparent 65%)',
          animation: 'trainerRestBreath 3s ease-in-out infinite',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            fontSize: 'var(--text-xs)', fontWeight: 700,
            color: 'hsl(var(--accent-h,158),50%,82%)',
            letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <Icon name="pause" size={10} /> {tr('workout.rest')}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-display)', fontWeight: 700, color: '#fff',
            marginTop: 4, letterSpacing: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>{mm}:{ss}</div>
          <div style={{ margin: '10px auto 0', width: '70%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 2, transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.75)', marginTop: 11, lineHeight: 1.45, padding: '0 8px' }}>
            {tr('workout.breathe')}
          </div>
          {onSkip && (
            <button onClick={onSkip} style={{
              marginTop: 12, height: 36, padding: '0 18px', borderRadius: 10,
              background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff', fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
            }}>{tr('workout.skipRest')}</button>
          )}
        </div>
      </Glass>
    </>
  )
}
