import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'
import { MuscleIcon } from '../../../components/ui/MuscleIcon.jsx'
import { StatusPill } from './ProgressStatus.jsx'

// ─── UpcomingExerciseItem ───────────────────────────────────────────────

export function UpcomingExerciseItem({ muscle, name, scheme, weightRange, trend, expanded, hasPartial, hasAlternatives, onClick, onDragStart, isDragging }) {
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
      <MuscleIcon name={muscle} size={36} style={{
        outline: hasPartial ? '1.5px solid var(--accent-color)' : undefined,
        outlineOffset: hasPartial ? 2 : undefined,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: '#ECEAEF',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3,
        }}>{name}</div>
        <div style={{ fontSize: 10.5, color: 'rgba(236,234,239,0.5)', marginTop: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span>{scheme}</span>
          {weightRange && <span>· {weightRange}</span>}
          {hasAlternatives && (
            <Icon name="swap" size={10} style={{ color: 'hsl(var(--accent-h,158),55%,70%)', flexShrink: 0 }} />
          )}
        </div>
      </div>
      {trend && trend !== 'first' && <StatusPill trend={trend} />}
      <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} style={{ color: 'rgba(236,234,239,0.35)' }} />
    </Glass>
  )
}
