import { useTranslation } from '../../../i18n/useTranslation.js'
import { Icon } from '../../../components/ui/Icon.jsx'

/**
 * QuickActions — two action cards below the hero block.
 */
export function QuickActions({ onFreeWorkout, onAskTrainer }) {
  const { t } = useTranslation()

  const actions = [
    {
      key: 'free',
      icon: 'dumbbell',
      title: t('home.quickFreeWorkout'),
      subtitle: t('home.quickFreeWorkoutDesc'),
      onClick: onFreeWorkout,
    },
    {
      key: 'trainer',
      icon: 'messageCircle',
      title: t('home.quickAskTrainer'),
      subtitle: t('home.quickAskTrainerDesc'),
      onClick: onAskTrainer,
    },
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 18,
      padding: '0 18px',
    }}>
      {actions.map(a => (
        <button
          key={a.key}
          onClick={a.onClick}
          style={{
            background: 'var(--gd-card)',
            borderRadius: 20,
            padding: 15,
            boxShadow: 'var(--gd-card-shadow)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          {/* Icon square */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'var(--gd-accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gd-accent-ink)',
            flexShrink: 0,
          }}>
            <Icon name={a.icon} size={20} strokeWidth={1.8} />
          </div>

          {/* Text */}
          <div>
            <div style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: 'var(--gd-ink)',
              lineHeight: 1.3,
            }}>
              {a.title}
            </div>
            <div style={{
              fontSize: 11.5,
              color: 'var(--gd-sub)',
              marginTop: 2,
            }}>
              {a.subtitle}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
