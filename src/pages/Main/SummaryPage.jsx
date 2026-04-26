/**
 * Summary Page — экран "Готово!" после завершения тренировки (BRD §12.3).
 *
 * Показывает: зелёную галочку, "Готово!", 3 stat-tile, CTA "К программе".
 * Данные из location.state (totalSets, totalExercises, elapsedSec).
 */
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'

export default function SummaryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation()

  const totalSets = state?.totalSets ?? 0
  const elapsedSec = state?.elapsedSec ?? 0

  // Тоннаж пока не считаем (нет weightKg в state), покажем прочерк
  const tonnage = state?.tonnage ?? null

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}ч ${m}м`
    return `${m} мин`
  }

  // Haptic feedback при монтировании
  useEffect(() => {
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch {}
  }, [])

  return (
    <div style={{
      background: 'var(--bg-app)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      {/* Green check circle */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'hsla(140, 55%, 40%, 0.2)',
        border: '2px solid hsla(140, 55%, 55%, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-5)',
      }}>
        <Icon name="check" size={40} style={{ color: 'hsl(140, 55%, 65%)' }} />
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--fg-primary)',
        margin: 0,
        marginBottom: 'var(--space-2)',
      }}>
        {t('summary.title')}
      </h1>

      {/* Subtitle */}
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--fg-secondary)',
        margin: 0,
        marginBottom: 'var(--space-6)',
        textAlign: 'center',
      }}>
        {t('summary.subtitle')}
      </p>

      {/* Stat tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: tonnage !== null ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: 'var(--space-3)',
        width: '100%',
        maxWidth: 360,
        marginBottom: 'var(--space-8)',
      }}>
        <Glass padding="14px" style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 'var(--weight-semi)',
            color: 'var(--fg-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            marginBottom: 'var(--space-1)',
          }}>
            {t('summary.sets')}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--fg-primary)',
          }}>
            {totalSets}
          </div>
        </Glass>

        <Glass padding="14px" style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 'var(--weight-semi)',
            color: 'var(--fg-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            marginBottom: 'var(--space-1)',
          }}>
            {t('summary.time')}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--fg-primary)',
          }}>
            {formatTime(elapsedSec)}
          </div>
        </Glass>

        {tonnage !== null && (
          <Glass padding="14px" style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 'var(--text-2xs)',
              fontWeight: 'var(--weight-semi)',
              color: 'var(--fg-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              marginBottom: 'var(--space-1)',
            }}>
              {t('summary.tonnage')}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--fg-primary)',
            }}>
              {tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)}т` : `${tonnage}кг`}
            </div>
          </Glass>
        )}
      </div>

      {/* CTA */}
      <Button
        variant="accent"
        size="lg"
        block
        onClick={() => navigate('/', { replace: true })}
        style={{ maxWidth: 360 }}
      >
        {t('summary.backHome')}
      </Button>
    </div>
  )
}
