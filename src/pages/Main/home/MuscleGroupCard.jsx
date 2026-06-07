import { useTranslation } from '../../../i18n/useTranslation.js'
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
  none: { ring: 'var(--gd-faint)', badge: 'transparent', text: 'var(--gd-faint)' },
  low: { ring: 'var(--gd-warn)', badge: 'rgba(245,194,75,0.12)', text: 'var(--gd-warn)' },
  optimal: { ring: 'var(--gd-success)', badge: 'rgba(61,219,134,0.12)', text: 'var(--gd-success)' },
  over: { ring: 'var(--gd-success)', badge: 'rgba(61,219,134,0.12)', text: 'var(--gd-success)' },
  overload: { ring: 'var(--gd-danger)', badge: 'rgba(244,112,127,0.12)', text: 'var(--gd-danger)' },
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
          fontSize: size * 0.32, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--gd-sub)',
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
          boxShadow: '0 0 14px 2px rgba(244,112,127,0.35)',
        }} />
      )}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r}
          stroke="var(--gd-line-soft)" strokeWidth={5} fill="none" />
        <circle cx={cx} cy={cy} r={r}
          stroke="rgba(61,219,134,0.2)" strokeWidth={5} fill="none"
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
          fontSize: size * 0.3, fontWeight: 700,
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
          width: 1, height: 12, background: 'var(--gd-line)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }

    let bg, border
    if (i > actual) {
      bg = 'transparent'
      border = '1.5px solid var(--gd-line-soft)'
    } else if (min && i < min) {
      bg = 'var(--gd-faint)'
      border = 'none'
    } else if (max && i > max) {
      bg = 'var(--gd-danger)'
      border = 'none'
    } else {
      bg = 'var(--gd-success)'
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
          width: 1, height: 12, background: 'var(--gd-line)',
          alignSelf: 'center', flexShrink: 0,
        }} />
      )
    }
  }

  if (overflowCount > 0) {
    elements.push(
      <span key="overflow" style={{
        fontSize: 10, color: 'var(--gd-danger)',
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
      padding: '3px 9px', borderRadius: 8,
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
    <div
      style={{
        background: 'var(--gd-card)',
        borderRadius: 20,
        padding: 16,
        boxShadow: 'var(--gd-card-shadow)',
        cursor: onTap ? 'pointer' : undefined,
      }}
      onClick={onTap ? () => onTap(group) : undefined}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
          {/* Icon square */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: 'var(--gd-inset)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name={iconName} size={18} strokeWidth={1.8} style={{
              color: 'var(--gd-accent-ink)',
            }} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14.5, fontWeight: 700,
              color: 'var(--gd-ink)',
              marginBottom: 2,
            }}>
              {group.nameRu}
            </div>

            {hasTarget && (
              <div style={{
                fontSize: 11.5, color: 'var(--gd-sub)',
                marginBottom: 8,
              }}>
                {t('progress.muscle.target', { min, max })}
              </div>
            )}

            <StatusBadge actual={group.setsActual} target={group.setsTarget} t={t} />
          </div>
        </div>

        <RingChart actual={group.setsActual} target={group.setsTarget} size={56} />
      </div>

      {group.subMuscles && group.subMuscles.length > 1 && (
        <>
          <div style={{
            height: 1, background: 'var(--gd-line-soft)',
            margin: '12px 0',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {group.subMuscles.map(sub => {
              const subMin = getMin(sub.setsTarget)
              const subMax = sub.setsTarget

              return (
                <div key={sub.muscle}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 5,
                  }}>
                    <span style={{
                      fontSize: 13, color: 'var(--gd-ink)',
                    }}>
                      {sub.nameRu}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', gap: 2,
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: STATUS_STYLES[getStatus(sub.setsActual, sub.setsTarget)].text,
                      }}>
                        {sub.setsActual}
                      </span>
                      {sub.setsTarget && (
                        <span style={{
                          fontSize: 11, color: 'var(--gd-faint)',
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
            height: 1, background: 'var(--gd-line-soft)',
            margin: '12px 0',
          }} />
          <DotLadder
            actual={group.setsActual}
            min={hasTarget ? min : null}
            max={hasTarget ? max : null}
          />
        </>
      )}
    </div>
  )
}
