import { useTranslation } from '../../../i18n/useTranslation.js'
import { Glass } from '../../../components/ui/Glass.jsx'
import { Icon } from '../../../components/ui/Icon.jsx'

// ─── Constants ──────────────────────────────────────────────────────────

export const MUSCLE_ICONS = {
  chest: 'chest', back: 'back', shoulders: 'shoulder',
  arms: 'arm', legs: 'leg', core: 'abs',
}

function getMin(target) {
  if (!target || target <= 0) return 0
  return Math.max(1, Math.ceil(target * 0.65))
}

function getStatus(actual, target) {
  if (!target || target <= 0) return 'none'
  const min = getMin(target)
  if (actual === 0) return 'none'
  if (actual < min) return 'low'
  if (actual <= target) return 'optimal'
  if (actual <= Math.ceil(target * 1.4)) return 'over'
  return 'overload'
}

const STATUS_STYLES = {
  none: { ring: 'var(--fg-disabled)', badge: 'transparent', text: 'var(--fg-disabled)' },
  low: { ring: 'hsl(35,80%,55%)', badge: 'hsla(35,80%,50%,0.15)', text: 'hsl(35,80%,60%)' },
  optimal: { ring: 'hsl(140,55%,55%)', badge: 'hsla(140,55%,45%,0.15)', text: 'hsl(140,55%,60%)' },
  over: { ring: 'hsl(140,55%,55%)', badge: 'hsla(140,55%,45%,0.15)', text: 'hsl(140,55%,60%)' },
  overload: { ring: 'hsl(0,65%,55%)', badge: 'hsla(0,60%,50%,0.15)', text: 'hsl(0,65%,65%)' },
}

// ─── RingChart ──────────────────────────────────────────────────────────

function RingChart({ actual, target, size = 56 }) {
  const min = getMin(target)
  const max = target || 0
  const status = getStatus(actual, target)
  const colors = STATUS_STYLES[status]

  if (!target || target <= 0) {
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.32, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--fg-secondary)',
        }}>{actual}</span>
      </div>
    )
  }

  const overflow = Math.max(2, Math.ceil(max * 0.4))
  const scale = Math.max(actual, max + overflow, min + 1)
  const r = size / 2 - 4
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const angOf = (s) => (s / scale) * 360

  const greenLen = circ * ((angOf(max) - angOf(min)) / 360)
  const fillLen = circ * Math.min(1, actual / scale)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {status === 'overload' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          boxShadow: '0 0 14px 2px hsla(0,65%,50%,0.45)',
        }} />
      )}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r}
          stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
        <circle cx={cx} cy={cy} r={r}
          stroke="hsla(140,55%,55%,0.25)" strokeWidth={5} fill="none"
          strokeDasharray={`${greenLen} ${circ}`}
          strokeDashoffset={`${-circ * (angOf(min) / 360)}`} />
        {actual > 0 && (
          <circle cx={cx} cy={cy} r={r}
            stroke={colors.ring} strokeWidth={5} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${circ}`}
            strokeDashoffset="0" />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.3, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: colors.ring,
        }}>{actual}</span>
      </div>
    </div>
  )
}

// ─── DotLadder ──────────────────────────────────────────────────────────

function DotLadder({ actual, min, max }) {
  const effectiveMax = max || actual
  const maxDots = Math.min(Math.max(actual, effectiveMax), effectiveMax + 8)
  const overflowCount = actual > maxDots ? actual - maxDots : 0

  const elements = []
  for (let i = 1; i <= maxDots; i++) {
    if (min && i === min) {
      elements.push(
        <span key={`ml-${i}`} style={{
          width: 1, height: 12, background: 'rgba(255,255,255,0.3)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }

    let bg, border
    if (i > actual) {
      bg = 'transparent'
      border = '1.5px solid rgba(255,255,255,0.1)'
    } else if (min && i < min) {
      bg = 'rgba(255,255,255,0.3)'
      border = 'none'
    } else if (max && i > max) {
      bg = 'hsl(0,65%,60%)'
      border = 'none'
    } else {
      bg = 'hsl(140,55%,55%)'
      border = 'none'
    }

    elements.push(
      <span key={`d-${i}`} style={{
        width: 7, height: 7, borderRadius: '50%',
        background: bg, border, flexShrink: 0,
      }} />
    )

    if (max && i === max) {
      elements.push(
        <span key={`mr-${i}`} style={{
          width: 1, height: 12, background: 'rgba(255,255,255,0.3)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }
  }

  if (overflowCount > 0) {
    elements.push(
      <span key="overflow" style={{
        fontSize: 10, color: 'hsl(0,65%,60%)',
        marginLeft: 2, flexShrink: 0,
      }}>+{overflowCount}</span>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: 3, flexWrap: 'wrap',
    }}>
      {elements}
    </div>
  )
}

// ─── StatusBadge ────────────────────────────────────────────────────────

function StatusBadge({ actual, target, t }) {
  const status = getStatus(actual, target)
  if (status === 'none') return null

  const styles = STATUS_STYLES[status]
  const diff = actual - (target || 0)

  let label
  if (status === 'low') label = t('progress.status.low', { n: getMin(target) - actual })
  else if (status === 'optimal') label = t('progress.status.optimal')
  else if (status === 'over') label = t('progress.status.over', { n: diff })
  else label = t('progress.status.overload', { n: diff })

  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 6,
      background: styles.badge, color: styles.text,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ─── MuscleGroupCard ────────────────────────────────────────────────────

export function MuscleGroupCard({ group, onTap }) {
  const { t } = useTranslation()
  const iconName = MUSCLE_ICONS[group.group] || 'activity'
  const hasTarget = group.setsTarget != null && group.setsTarget > 0
  const min = getMin(group.setsTarget)
  const max = group.setsTarget

  return (
    <Glass
      style={{ padding: 'var(--space-4)', cursor: onTap ? 'pointer' : undefined }}
      onClick={onTap ? () => onTap(group) : undefined}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 'var(--space-3)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            marginBottom: 4,
          }}>
            <Icon name={iconName} size={18} style={{
              color: 'hsl(var(--accent-h,158),55%,72%)',
            }} />
            <span style={{
              fontSize: 'var(--text-base)', fontWeight: 600,
              color: 'var(--fg-primary)',
            }}>
              {group.nameRu}
            </span>
          </div>

          {hasTarget && (
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
              marginBottom: 6,
            }}>
              {t('progress.muscle.target', { min, max })}
            </div>
          )}

          <StatusBadge actual={group.setsActual} target={group.setsTarget} t={t} />
        </div>

        <RingChart actual={group.setsActual} target={group.setsTarget} size={56} />
      </div>

      {group.subMuscles && group.subMuscles.length > 1 && (
        <>
          <div style={{
            height: 1, background: 'rgba(255,255,255,0.05)',
            margin: 'var(--space-3) 0',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {group.subMuscles.map(sub => {
              const subMin = getMin(sub.setsTarget)
              const subMax = sub.setsTarget

              return (
                <div key={sub.muscle}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 'var(--text-sm)', color: 'var(--fg-primary)',
                    }}>
                      {sub.nameRu}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', gap: 2,
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: 'var(--text-sm)', fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: STATUS_STYLES[getStatus(sub.setsActual, sub.setsTarget)].text,
                      }}>
                        {sub.setsActual}
                      </span>
                      {sub.setsTarget && (
                        <span style={{
                          fontSize: 10, color: 'var(--fg-disabled)',
                        }}>
                          /{subMin}–{subMax}
                        </span>
                      )}
                    </div>
                  </div>

                  <DotLadder
                    actual={sub.setsActual}
                    min={sub.setsTarget ? subMin : null}
                    max={sub.setsTarget ? subMax : null}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      {group.subMuscles && group.subMuscles.length === 1 && (
        <>
          <div style={{
            height: 1, background: 'rgba(255,255,255,0.05)',
            margin: 'var(--space-3) 0',
          }} />
          <DotLadder
            actual={group.setsActual}
            min={hasTarget ? min : null}
            max={hasTarget ? max : null}
          />
        </>
      )}
    </Glass>
  )
}
