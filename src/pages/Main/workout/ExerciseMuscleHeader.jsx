import { useTranslation } from '../../../i18n/useTranslation.js'
import { MuscleIcon } from '../../../components/ui/MuscleIcon.jsx'

const LABEL_KEYS = {
  chest: 'chest', upper_chest: 'chest', mid_chest: 'chest', lower_chest: 'chest',
  back: 'back', 'middle back': 'back', 'lower back': 'lowerBack', upper_back: 'back',
  middle_back: 'back', lower_back: 'lowerBack', lats: 'lats', traps: 'traps',
  shoulders: 'shoulders', front_delt: 'frontDelt', side_delt: 'sideDelt', rear_delt: 'rearDelt',
  front_delts: 'frontDelt', side_delts: 'sideDelt', rear_delts: 'rearDelt',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  quadriceps: 'quads', quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes',
  calves: 'calves', adductors: 'adductors', abductors: 'abductors',
  abdominals: 'abs', abs: 'abs', core: 'abs', obliques: 'obliques', neck: 'neck',
}

export function ExerciseMuscleHeader({ muscle, scheme, marker, children }) {
  const { t } = useTranslation()
  const label = LABEL_KEYS[muscle]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, color: 'var(--fg-tertiary)', fontSize: 11 }}>
      <MuscleIcon name={muscle} size={28} />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{label ? t(`workout.muscle.${label}`) : null}</span>
      {marker && <span style={{ color: 'var(--accent-color)' }}>{marker}</span>}
      {scheme && <span style={{ color: 'var(--fg-secondary)', whiteSpace: 'nowrap' }}>{scheme}</span>}
      {children}
    </div>
  )
}
