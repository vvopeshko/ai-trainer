import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

// ─── UpcomingExerciseItem ───────────────────────────────────────────────

export function UpcomingExerciseItem({ index, name, scheme, expanded, hasPartial, hasAlternatives, onClick, onDragStart, isDragging }) {
  // translateY во время драга применяется императивно к wrapper'у в WorkoutPage
  // (через ref, без ре-рендера). Здесь — только «поднятый» вид: scale/тень/opacity.
  return (
    <Glass padding="11px 12px" radius={11} style={{
      display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
      ...(isDragging && {
        transform: 'scale(1.02)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        opacity: 0.95,
      }),
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
        <div style={{ fontSize: 10.5, color: 'rgba(236,234,239,0.5)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{scheme}</span>
          {hasAlternatives && (
            <Icon name="swap" size={10} style={{ color: 'hsl(var(--accent-h,158),55%,70%)', flexShrink: 0 }} />
          )}
        </div>
      </div>
      <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}
