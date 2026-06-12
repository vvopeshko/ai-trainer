/**
 * ExerciseDetailSheet — fullscreen overlay with tabbed exercise details.
 *
 * Three tabs: Instructions (GIF/video + technique steps), Muscles (BodyMap + chips),
 * Settings (unit, weight step, min/max, exercise type).
 *
 * Used on WorkoutPage, LibraryPage, ProgramEditPage.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useExerciseDetail } from '../../hooks/queries.js'
import { getExerciseSettings, setExerciseSettings, saveSettingsToServer, PRESETS, getDefaultPreset, getPresetsForEquipment } from '../../utils/weightUnit.js'
import { getMuscleName, getEquipmentName } from '../../utils/muscleMapping.js'
import { BodyMap } from './BodyMap.jsx'
import { Skeleton } from './Skeleton.jsx'
import { Glass } from './Glass.jsx'
import { Icon } from './Icon.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────

function extractYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

function isVideoUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')
  } catch { return false }
}

/** Format number with comma as decimal separator (2.5 → "2,5") */
function formatDecimal(n) {
  return String(n).replace('.', ',')
}

// ─── Animations (injected once) ──────────────────────────────────────

const KEYFRAMES = `
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0.7; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes fadeUp {
  from { transform: translateY(6px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
`

// ─── Header ──────────────────────────────────────────────────────────

function Header({ exercise, onClose }) {
  const primaryMuscle = exercise?.primaryMuscles?.[0]
  const equipment = exercise?.equipment
  const subtitle = [
    primaryMuscle && getMuscleName(primaryMuscle),
    equipment && getEquipmentName(equipment),
  ].filter(Boolean).join(' · ')

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 12px 10px',
      paddingTop: 'calc(var(--safe-top, 0px) + 12px)',
      flexShrink: 0, minHeight: 40,
    }}>
      {/* Back button */}
      <button
        onClick={onClose}
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg-secondary)', flexShrink: 0,
        }}
      >
        <Icon name="chevronLeft" size={17} />
      </button>

      {/* Title + subtitle */}
      <div style={{
        flex: 1, textAlign: 'center', minWidth: 0,
        padding: '0 4px',
      }}>
        <div style={{
          fontSize: 15.5, fontWeight: 600, color: 'var(--fg-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {exercise?.nameRu || ''}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 10.5, color: 'rgba(236,234,239,0.45)',
            marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Swap button (placeholder) */}
      <button
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg-secondary)', flexShrink: 0,
          opacity: 0.5,
        }}
        disabled
      >
        <Icon name="swap" size={15} />
      </button>
    </header>
  )
}

// ─── SegTabs ─────────────────────────────────────────────────────────

const TABS = ['instructions', 'muscles', 'settings']

function SegTabs({ active, onChange, t }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4, margin: '0 16px 12px',
      borderRadius: 13,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {TABS.map(tab => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              flex: 1, height: 36, borderRadius: 10, border: 'none',
              fontSize: 12.5, cursor: 'pointer',
              fontWeight: isActive ? 700 : 500,
              background: isActive ? 'hsl(var(--accent-h),55%,55%)' : 'transparent',
              color: isActive ? '#0a1815' : 'rgba(236,234,239,0.6)',
              transition: 'all .18s ease',
            }}
          >
            {t(`exercise.tab.${tab}`)}
          </button>
        )
      })}
    </div>
  )
}

// ─── SectionLabel ────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, color: 'rgba(236,234,239,0.45)',
      textTransform: 'uppercase', letterSpacing: '0.14em',
      marginBottom: 9, padding: '0 2px',
    }}>
      {children}
    </div>
  )
}

// ─── DemoMedia ───────────────────────────────────────────────────────

function DemoMedia({ url, alt, isVideo }) {
  const badge = isVideo ? 'Video' : 'GIF'

  return (
    <div style={{
      aspectRatio: '4/3', borderRadius: 16, overflow: 'hidden',
      position: 'relative',
      background: 'radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.06), rgba(255,255,255,0.015))',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      {isVideo ? (
        <video
          src={url}
          autoPlay loop muted playsInline
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <img
          src={url}
          alt={alt}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* Badge */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        display: 'flex', alignItems: 'center', gap: 5,
        height: 24, padding: '0 10px', borderRadius: 999,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'hsl(var(--accent-h),55%,55%)',
        }} />
        <span style={{ fontSize: 10.5, color: 'var(--fg-primary)', fontWeight: 500 }}>
          {badge}
        </span>
      </div>
    </div>
  )
}

// ─── VideoRow ────────────────────────────────────────────────────────

function VideoRow({ videos }) {
  if (!videos || videos.length === 0) return null

  return (
    <Glass radius={14}>
      {videos.map((video, i) => {
        const videoId = extractYouTubeId(video.url)
        const thumb = videoId
          ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          : null

        return (
          <a
            key={i}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 11px',
              textDecoration: 'none',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            {/* Thumbnail */}
            <div style={{
              width: 62, height: 42, borderRadius: 9, flexShrink: 0,
              overflow: 'hidden', position: 'relative',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            }}>
              {thumb && (
                <img
                  src={thumb} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {/* Play overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="play" size={10} style={{ marginLeft: 1 }} />
                </div>
              </div>
            </div>

            {/* Title + channel */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 500, color: 'var(--fg-primary)',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.35,
              }}>
                {video.title || 'YouTube'}
              </div>
              {video.channel && (
                <div style={{
                  fontSize: 10.5, color: 'rgba(236,234,239,0.45)',
                  marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {video.channel}
                </div>
              )}
            </div>

            {/* Chevron */}
            <Icon name="chevronRight" size={14} style={{ color: 'rgba(236,234,239,0.3)', flexShrink: 0 }} />
          </a>
        )
      })}
    </Glass>
  )
}

// ─── StepCard ────────────────────────────────────────────────────────

function StepCard({ number, text }) {
  return (
    <Glass radius={12} padding="12px 13px" style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
        background: 'hsla(var(--accent-h),55%,50%,0.16)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--accent-h),55%,78%)',
        fontFamily: 'var(--font-mono)',
      }}>
        {number}
      </div>
      <div style={{
        fontSize: 12.5, lineHeight: 1.5, color: 'rgba(236,234,239,0.85)',
      }}>
        {text}
      </div>
    </Glass>
  )
}

// ─── Chip ────────────────────────────────────────────────────────────

const chipStyles = {
  primary: {
    background: 'hsla(var(--accent-h),55%,45%,0.18)',
    color: 'hsl(var(--accent-h),55%,78%)',
    border: '1px solid hsla(var(--accent-h),55%,55%,0.30)',
  },
  neutral: {
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(236,234,239,0.78)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  meta: {
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(236,234,239,0.55)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
}

function Chip({ variant = 'neutral', icon, children }) {
  const s = chipStyles[variant]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 30, borderRadius: 999, padding: '0 13px',
      fontSize: 12, fontWeight: 500,
      ...s,
    }}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

// ─── Toggle2 ─────────────────────────────────────────────────────────

function Toggle2({ options, value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      borderRadius: 13,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, height: 42, borderRadius: 10, border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: isActive ? '#ECEAEF' : 'rgba(236,234,239,0.5)',
              boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
              transition: 'all .18s ease',
            }}
          >
            {opt.icon && <Icon name={opt.icon} size={15} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Stepper ─────────────────────────────────────────────────────────

function Stepper({ value, onChange, step = 0.5, min = 0, suffix }) {
  const decrement = () => {
    const next = Math.max(min, +(value - step).toFixed(2))
    onChange(next)
  }
  const increment = () => {
    onChange(+(value + step).toFixed(2))
  }

  return (
    <div style={{
      display: 'flex', height: 46, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <button
        onClick={decrement}
        style={{
          width: 46, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--fg-secondary)',
          fontSize: 20, fontWeight: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        −
      </button>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
          color: 'var(--fg-primary)',
        }}>
          {formatDecimal(value)}
        </span>
        {suffix && (
          <span style={{ fontSize: 11, color: 'rgba(236,234,239,0.45)' }}>
            {suffix}
          </span>
        )}
      </div>
      <button
        onClick={increment}
        style={{
          width: 46, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--fg-secondary)',
          fontSize: 20, fontWeight: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  )
}

// ─── NumberField ─────────────────────────────────────────────────────

function NumberField({ value, onChange, suffix }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
        style={{
          width: '100%', height: 46, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--fg-primary)',
          fontSize: 15, fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          padding: suffix ? '0 40px 0 14px' : '0 14px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {suffix && (
        <span style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 11, color: 'rgba(236,234,239,0.45)',
          pointerEvents: 'none',
        }}>
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─── Instructions Tab ────────────────────────────────────────────────

function InstructionsTab({ exercise, t }) {
  const videos = exercise.videos || []
  const hasMedia = exercise.gifUrl
  const steps = exercise.instructions
    ? exercise.instructions.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  const hasRuContent = exercise.descriptionRu || exercise.typicalMistakes

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* GIF / Video preview */}
      {hasMedia && (
        <DemoMedia
          url={exercise.gifUrl}
          alt={exercise.nameRu}
          isVideo={isVideoUrl(exercise.gifUrl)}
        />
      )}

      {/* Russian description */}
      {exercise.descriptionRu && (
        <div>
          <SectionLabel>{t('library.description')}</SectionLabel>
          <Glass radius={12} padding="12px 13px">
            <p style={{
              fontSize: 12.5, color: 'rgba(236,234,239,0.85)',
              lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line',
            }}>
              {exercise.descriptionRu}
            </p>
          </Glass>
        </div>
      )}

      {/* Typical mistakes (RU) */}
      {exercise.typicalMistakes && (
        <div>
          <SectionLabel>{t('library.mistakes')}</SectionLabel>
          <Glass radius={12} padding="12px 13px">
            <p style={{
              fontSize: 12.5, color: 'rgba(236,234,239,0.85)',
              lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line',
            }}>
              {exercise.typicalMistakes}
            </p>
          </Glass>
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div>
          <SectionLabel>{t('library.videos')}</SectionLabel>
          <VideoRow videos={videos} />
        </div>
      )}

      {/* Technique steps (EN fallback) */}
      {steps.length > 0 && (
        <div>
          <SectionLabel>{t('exercise.technique')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((text, i) => (
              <StepCard key={i} number={i + 1} text={text} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasMedia && !videos.length && !steps.length && !hasRuContent && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: 'var(--fg-tertiary)', fontSize: 13,
        }}>
          {t('library.noResults')}
        </div>
      )}
    </div>
  )
}

// ─── Muscles Tab ─────────────────────────────────────────────────────

function MusclesTab({ exercise, t }) {
  const primaryMuscles = exercise.primaryMuscles || []
  const secondaryMuscles = exercise.secondaryMuscles || []

  const bodyMapMuscles = primaryMuscles.map(m => ({
    muscle: m, setsActual: 10, setsTarget: 10,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* BodyMap */}
      {primaryMuscles.length > 0 && (
        <Glass radius={16} padding="14px 10px 6px">
          <BodyMap muscles={bodyMapMuscles} height={200} />
          <div style={{
            display: 'flex', justifyContent: 'space-around',
            marginTop: 2,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 500, color: 'rgba(236,234,239,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.14em',
            }}>
              {t('exercise.front')}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 500, color: 'rgba(236,234,239,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.14em',
            }}>
              {t('exercise.back')}
            </span>
          </div>
        </Glass>
      )}

      {/* Primary muscles chips */}
      {primaryMuscles.length > 0 && (
        <div>
          <SectionLabel>{t('exercise.primary')}</SectionLabel>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {primaryMuscles.map(m => (
              <Chip key={m} variant="primary">{getMuscleName(m)}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Secondary muscles chips */}
      {secondaryMuscles.length > 0 && (
        <div>
          <SectionLabel>{t('exercise.secondary')}</SectionLabel>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {secondaryMuscles.map(m => (
              <Chip key={m} variant="neutral">{getMuscleName(m)}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Characteristics */}
      {(exercise.difficulty || exercise.category) && (
        <div>
          <SectionLabel>{t('exercise.characteristics')}</SectionLabel>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {exercise.difficulty && (
              <Chip variant="meta" icon="activity">
                {t(`library.diff.${exercise.difficulty}`)}
              </Chip>
            )}
            {exercise.category && (
              <Chip variant="meta" icon="zap">
                {t(`library.cat.${exercise.category}`)}
              </Chip>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Settings Tab ────────────────────────────────────────────────────

function PresetChips({ presetIds, active, onChange, t }) {
  return (
    <div style={{
      display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4,
      WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      {presetIds.map(id => {
        const isActive = id === active
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flexShrink: 0, height: 34, borderRadius: 999,
              border: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)',
              padding: '0 14px', cursor: 'pointer',
              fontSize: 12, fontWeight: isActive ? 700 : 500,
              whiteSpace: 'nowrap',
              background: isActive ? 'hsl(var(--accent-h),55%,55%)' : 'rgba(255,255,255,0.06)',
              color: isActive ? '#0a1815' : 'rgba(236,234,239,0.7)',
              transition: 'all .18s ease',
            }}
          >
            {t(`exercise.preset.${id}`)}
          </button>
        )
      })}
    </div>
  )
}

function SettingsTab({ exercise, settings, onSettingsChange, onSave, t }) {
  const presetIds = getPresetsForEquipment(exercise?.equipment)
  const activePreset = settings.preset || 'custom'
  const isCustom = activePreset === 'custom'

  const handlePreset = (presetId) => {
    if (presetId === 'custom') {
      onSettingsChange({ ...settings, preset: 'custom' })
      return
    }
    const p = PRESETS[presetId]
    if (!p) return
    onSettingsChange({
      ...settings,
      preset: presetId,
      unit: p.unit,
      step: p.step,
      stepUnit: p.stepUnit,
      minWeight: p.minWeight,
      maxWeight: p.maxWeight,
    })
  }

  const handleUnit = (unit) => {
    onSettingsChange({ ...settings, unit, preset: 'custom' })
  }

  const handleStepUnit = (stepUnit) => {
    onSettingsChange({ ...settings, stepUnit, preset: 'custom' })
  }

  const handleStep = (v) => {
    if (v > 0 && v <= 50) onSettingsChange({ ...settings, step: v, preset: 'custom' })
  }

  const handleMin = (v) => {
    if (v >= 0) onSettingsChange({ ...settings, minWeight: v, preset: 'custom' })
  }

  const handleMax = (v) => {
    if (v > 0) onSettingsChange({ ...settings, maxWeight: v, preset: 'custom' })
  }

  const handleType = (type) => {
    onSettingsChange({ ...settings, type })
  }

  const unitLabel = settings.unit === 'lbs' ? 'lbs' : 'кг'
  const stepUnitLabel = settings.stepUnit === 'lbs' ? 'lbs' : 'кг'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Preset chips */}
      <div>
        <SectionLabel>{t('exercise.settings.preset')}</SectionLabel>
        <PresetChips presetIds={presetIds} active={activePreset} onChange={handlePreset} t={t} />
      </div>

      {/* Preset summary (when not custom) */}
      {!isCustom && (
        <Glass radius={12} padding="12px 14px">
          <div style={{
            fontSize: 12.5, color: 'rgba(236,234,239,0.75)', lineHeight: 1.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(236,234,239,0.45)' }}>{t('exercise.settings.unit')}</span>
              <span>{unitLabel.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(236,234,239,0.45)' }}>{t('exercise.settings.step')}</span>
              <span>{formatDecimal(settings.step)} {stepUnitLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(236,234,239,0.45)' }}>{t('exercise.settings.minWeight')} / {t('exercise.settings.maxWeight')}</span>
              <span>{settings.minWeight} – {settings.maxWeight} {unitLabel}</span>
            </div>
          </div>
        </Glass>
      )}

      {/* Custom fields (only when preset is 'custom') */}
      {isCustom && (
        <>
          {/* Unit toggle */}
          <div>
            <SectionLabel>{t('exercise.settings.unit')}</SectionLabel>
            <Toggle2
              value={settings.unit}
              onChange={handleUnit}
              options={[
                { value: 'kg', label: 'КГ' },
                { value: 'lbs', label: 'LBS' },
              ]}
            />
          </div>

          {/* Step unit toggle */}
          <div>
            <SectionLabel>{t('exercise.settings.stepUnit')}</SectionLabel>
            <Toggle2
              value={settings.stepUnit || 'kg'}
              onChange={handleStepUnit}
              options={[
                { value: 'kg', label: 'КГ' },
                { value: 'lbs', label: 'LBS' },
              ]}
            />
          </div>

          {/* Weight step */}
          <div>
            <SectionLabel>{t('exercise.settings.step')}</SectionLabel>
            <Stepper
              value={settings.step}
              onChange={handleStep}
              step={0.5}
              min={0.5}
              suffix={settings.stepUnit || settings.unit}
            />
            <div style={{
              fontSize: 10.5, color: 'rgba(236,234,239,0.4)',
              marginTop: 6, padding: '0 2px',
            }}>
              {t('exercise.settings.stepHint')}
            </div>
          </div>

          {/* Min / Max weight */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <SectionLabel>{t('exercise.settings.minWeight')}</SectionLabel>
              <NumberField
                value={settings.minWeight}
                onChange={handleMin}
                suffix={settings.unit}
              />
            </div>
            <div>
              <SectionLabel>{t('exercise.settings.maxWeight')}</SectionLabel>
              <NumberField
                value={settings.maxWeight}
                onChange={handleMax}
                suffix={settings.unit}
              />
            </div>
          </div>
        </>
      )}

      {/* Exercise type toggle */}
      <div>
        <SectionLabel>{t('exercise.settings.type')}</SectionLabel>
        <Toggle2
          value={settings.type}
          onChange={handleType}
          options={[
            { value: 'reps', label: t('exercise.settings.typeReps'), icon: 'list' },
            { value: 'timer', label: t('exercise.settings.typeTimer'), icon: 'clock' },
          ]}
        />
        <div style={{
          fontSize: 10.5, color: 'rgba(236,234,239,0.4)',
          marginTop: 6, padding: '0 2px',
        }}>
          {settings.type === 'reps'
            ? t('exercise.settings.typeRepsHint')
            : t('exercise.settings.typeTimerHint')}
        </div>
      </div>

      {/* Save button */}
      {onSave && (
        <button
          onClick={onSave}
          style={{
            height: 50, borderRadius: 13, border: 'none',
            background: 'hsl(var(--accent-h),55%,55%)',
            color: '#0a1815', fontWeight: 700, fontSize: 15,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <Icon name="check" size={14} strokeWidth={2.5} />
          {t('exercise.settings.save')}
        </button>
      )}
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
      <Skeleton width="60%" height={20} />
      <Skeleton height={200} radius={16} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton width={80} height={30} radius={999} />
        <Skeleton width={80} height={30} radius={999} />
        <Skeleton width={80} height={30} radius={999} />
      </div>
      <Skeleton height={60} />
    </div>
  )
}

// ─── ExerciseDetailSheet ─────────────────────────────────────────────

export function ExerciseDetailSheet({ exerciseId, open, onClose, onSettingsChange }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('instructions')
  const [settings, setSettings] = useState(null)
  const [tabKey, setTabKey] = useState(0)
  const [prevExerciseId, setPrevExerciseId] = useState(null)

  // Use TanStack Query — cached, placeholderData from catalog
  const { data: exercise = null, isLoading: loading } = useExerciseDetail(open ? exerciseId : null)

  // Reset tab when opening a different exercise
  useEffect(() => {
    if (!open) {
      setPrevExerciseId(null)
      setActiveTab('instructions')
      setSettings(null)
      return
    }
    if (exerciseId !== prevExerciseId) {
      setPrevExerciseId(exerciseId)
      setActiveTab('instructions')
      setSettings(null)
    }
  }, [open, exerciseId, prevExerciseId])

  // Init settings when exercise data arrives
  useEffect(() => {
    if (!exercise?.slug || settings) return
    const saved = getExerciseSettings(exercise.slug)
    // Auto-detect preset from equipment if no preset saved
    if (!saved.preset) {
      const presetId = getDefaultPreset(exercise.equipment)
      const p = PRESETS[presetId]
      if (p) {
        const withPreset = { ...saved, preset: presetId, ...p }
        setSettings(withPreset)
        setExerciseSettings(exercise.slug, withPreset)
      } else {
        setSettings(saved)
      }
    } else {
      setSettings(saved)
    }
  }, [exercise?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings)
    if (exercise?.slug) {
      setExerciseSettings(exercise.slug, newSettings)
      saveSettingsToServer(exercise.slug, newSettings)
    }
    onSettingsChange?.(newSettings)
  }, [exercise?.slug, onSettingsChange])

  const handleSave = useCallback(() => {
    if (exercise?.slug && settings) {
      setExerciseSettings(exercise.slug, settings)
      onSettingsChange?.(settings)
    }
    onClose()
  }, [exercise?.slug, settings, onSettingsChange, onClose])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    setTabKey(k => k + 1)
  }, [])

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'var(--bg-app)',
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.25s ease-out',
    }}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <Header exercise={exercise} onClose={onClose} />

      {/* Tabs */}
      <SegTabs active={activeTab} onChange={handleTabChange} t={t} />

      {/* Content */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '0 16px 32px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {loading ? (
          <DetailSkeleton />
        ) : exercise ? (
          <div key={tabKey} style={{ animation: 'fadeUp .35s ease-out' }}>
            {activeTab === 'instructions' && <InstructionsTab exercise={exercise} t={t} />}
            {activeTab === 'muscles' && <MusclesTab exercise={exercise} t={t} />}
            {activeTab === 'settings' && settings && (
              <SettingsTab
                exercise={exercise}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onSave={onSettingsChange ? handleSave : null}
                t={t}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
