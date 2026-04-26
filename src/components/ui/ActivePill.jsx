import { Icon } from './Icon.jsx'

const pillKeyframes = `
@keyframes trainerGlassPulse {
  0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.35); }
  50%      { box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.35), 0 0 0 6px hsla(var(--accent-h,158), 70%, 55%, 0.08); }
}
.trainer-glass-pill-pulse { animation: trainerGlassPulse 3.4s ease-in-out infinite; }
`

/**
 * Persistent "workout in progress" pill. Slowly pulses.
 * Render at the top of Home while a session is active.
 */
export function ActivePill({ name, mmss, onOpen }) {
  return (
    <>
      <style>{pillKeyframes}</style>
      <button
        onClick={onOpen}
        className="trainer-glass-pill-pulse"
        style={{
          width: '100%', cursor: 'pointer', textAlign: 'left',
          borderRadius: 12, padding: '10px 12px 10px 14px',
          color: 'var(--fg-primary)',
          background: 'rgba(28,28,34,0.7)',
          backdropFilter: 'blur(22px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.25)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'relative', overflow: 'hidden',
        }}
      >
        <span style={{
          position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
          background: 'var(--accent-color-strong)', borderRadius: 2,
        }} />
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'hsl(var(--accent-h,158),70%,68%)',
          boxShadow: '0 0 6px hsla(var(--accent-h,158),70%,55%,0.7)',
          marginLeft: 4,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase', color: 'var(--fg-tertiary)',
          }}>active</div>
          <div style={{
            fontSize: 'var(--text-md)', fontWeight: 600, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 17, fontWeight: 600, color: '#fff',
          fontVariantNumeric: 'tabular-nums',
        }}>{mmss}</div>
        <Icon name="arrowRight" size={13} />
      </button>
    </>
  )
}
