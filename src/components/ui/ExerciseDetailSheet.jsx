/**
 * ExerciseDetailSheet — reusable BottomSheet with exercise details.
 *
 * Fetches full exercise data (GIF, videos, instructions) by ID and renders
 * inside a BottomSheet. Used on LibraryPage, ProgramEditPage, WorkoutPage.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../i18n/useTranslation.js'
import { apiGet } from '../../utils/api.js'
import { BottomSheet } from './BottomSheet.jsx'
import { Skeleton } from './Skeleton.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────

function extractYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

// ─── DetailSection ────────────────────────────────────────────────────

function DetailSection({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ─── ExerciseDetail ───────────────────────────────────────────────────

function ExerciseDetail({ exercise, t }) {
  if (!exercise) return null

  const videos = exercise.videos || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Title */}
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg-primary)' }}>
        {exercise.nameRu}
      </div>

      {/* GIF */}
      {exercise.gifUrl && (
        <img
          src={exercise.gifUrl}
          alt={exercise.nameRu}
          style={{
            width: '100%', maxHeight: 200, objectFit: 'contain',
            borderRadius: 12, background: 'rgba(255,255,255,0.04)',
          }}
        />
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <DetailSection label={t('library.videos')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-2)',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    textDecoration: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      style={{
                        width: 80, height: 45, objectFit: 'cover',
                        borderRadius: 6, flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-sm)', color: 'var(--fg-primary)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {video.title || 'YouTube'}
                    </div>
                    {video.channel && (
                      <div style={{
                        fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)',
                        marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {video.channel}
                      </div>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
        </DetailSection>
      )}

      {/* Badges: difficulty + category */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {exercise.difficulty && (
          <span style={{
            padding: '3px 10px', borderRadius: 12,
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'rgba(255,255,255,0.08)', color: 'var(--fg-secondary)',
          }}>
            {t(`library.diff.${exercise.difficulty}`)}
          </span>
        )}
        {exercise.category && (
          <span style={{
            padding: '3px 10px', borderRadius: 12,
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'rgba(255,255,255,0.08)', color: 'var(--fg-secondary)',
          }}>
            {t(`library.cat.${exercise.category}`)}
          </span>
        )}
      </div>

      {/* Primary muscles */}
      {exercise.primaryMuscles?.length > 0 && (
        <DetailSection label={t('library.muscles')}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {exercise.primaryMuscles.map(m => (
              <span key={m} style={{
                padding: '3px 10px', borderRadius: 12,
                fontSize: 'var(--text-xs)',
                background: 'hsla(var(--accent-h,158),60%,40%,0.2)',
                color: 'hsl(var(--accent-h,158),60%,70%)',
              }}>
                {m}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Equipment */}
      {exercise.equipment?.length > 0 && (
        <DetailSection label={t('library.equipment')}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {exercise.equipment.map(eq => (
              <span key={eq} style={{
                padding: '3px 10px', borderRadius: 12,
                fontSize: 'var(--text-xs)',
                background: 'rgba(255,255,255,0.08)', color: 'var(--fg-secondary)',
              }}>
                {t(`library.equip.${eq}`)}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Instructions */}
      {exercise.instructions && (
        <DetailSection label={t('library.instructions')}>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {exercise.instructions}
          </p>
        </DetailSection>
      )}

      {/* Typical mistakes */}
      {exercise.typicalMistakes && (
        <DetailSection label={t('library.mistakes')}>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {exercise.typicalMistakes}
          </p>
        </DetailSection>
      )}

      {/* Description */}
      {exercise.description && (
        <DetailSection label={t('library.description')}>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)',
            lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line',
          }}>
            {exercise.description}
          </p>
        </DetailSection>
      )}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
      <Skeleton width="60%" height={20} />
      <Skeleton height={160} radius={12} />
      <Skeleton width="40%" height={14} />
      <Skeleton height={60} />
    </div>
  )
}

// ─── ExerciseDetailSheet ──────────────────────────────────────────────

export function ExerciseDetailSheet({ exerciseId, open, onClose }) {
  const { t } = useTranslation()
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !exerciseId) {
      setExercise(null)
      return
    }
    setLoading(true)
    setExercise(null)
    apiGet(`/api/v1/exercises/${exerciseId}`)
      .then(data => setExercise(data.exercise))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, exerciseId])

  return (
    <BottomSheet open={open} onClose={onClose}>
      {loading ? <DetailSkeleton /> : <ExerciseDetail exercise={exercise} t={t} />}
    </BottomSheet>
  )
}
