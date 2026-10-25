import { MuscleIcon } from './MuscleIcon.jsx'

export function MuscleTile({ muscle, children, primary = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
      padding: 10, borderRadius: 16,
      background: primary ? 'rgba(78,217,160,0.07)' : 'var(--surface-0)',
      border: primary ? '1px solid rgba(78,217,160,0.16)' : '1px solid rgba(255,255,255,0.06)',
    }}>
      <MuscleIcon name={muscle} size={52} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)', overflowWrap: 'anywhere' }}>
        {children}
      </span>
    </div>
  )
}
