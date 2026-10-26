import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'
import { MuscleIcon } from '../../../components/ui/MuscleIcon.jsx'

// ─── CollapsedExercise (done exercise row) ──────────────────────────────

export function CollapsedExercise({ muscle, name, summary, expanded, onClick }) {
  return (
    <Glass flat padding="9px 12px" radius={expanded ? '10px 10px 0 0' : 10} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)',
      cursor: 'pointer',
      ...(expanded && { borderBottom: 'none' }),
    }} onClick={onClick}>
      <div style={{ position: 'relative', flexShrink: 0, width: 32, height: 32 }}>
        <MuscleIcon name={muscle} size={32} />
        <span style={{
          position: 'absolute', bottom: -2, right: -3, width: 13, height: 13, borderRadius: '50%',
          background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="check" size={9} strokeWidth={3} />
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: 'rgba(236,234,239,0.9)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3,
        }}>{name}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(236,234,239,0.55)' }}>
        {summary}
      </div>
      <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={13} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}
