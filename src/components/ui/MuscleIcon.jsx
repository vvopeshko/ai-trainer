import sprite from '../../assets/muscle-icons.png'
import { Icon } from './Icon.jsx'

// Tile bounds in the supplied 1536 × 1024 sheet, excluding its labels.
const TILES = {
  chest: [71, 62], back: [362, 62], shoulder: [652, 62],
  arm: [943, 62], leg: [1233, 62], abs: [71, 368],
  glutes: [362, 368], lats: [652, 368], traps: [943, 368],
  forearms: [1233, 368], biceps: [71, 671], triceps: [362, 671],
  delts: [652, 671], calves: [943, 671], adductors: [1233, 671],
}

const ALIASES = {
  shoulders: 'shoulder', arms: 'arm', legs: 'leg', core: 'abs',
  abdominals: 'abs', obliques: 'abs', quadriceps: 'leg', quads: 'leg', hamstrings: 'leg', abductors: 'leg',
  upper_chest: 'chest', mid_chest: 'chest', lower_chest: 'chest',
  front_delt: 'delts', side_delt: 'delts', rear_delt: 'delts',
  front_delts: 'delts', side_delts: 'delts', rear_delts: 'delts',
  'middle back': 'back', 'lower back': 'back', middle_back: 'back', lower_back: 'back', upper_back: 'back',
  'Грудь': 'chest', 'Спина': 'back', 'Плечи': 'shoulder', 'Руки': 'arm',
  'Ноги': 'leg', 'Пресс': 'abs', 'Бицепс': 'biceps', 'Трицепс': 'triceps', 'Предплечья': 'forearms',
}

export function MuscleIcon({ name, size = 40, style, ...rest }) {
  const tile = TILES[ALIASES[name] || name]
  if (!tile) return <Icon name="activity" size={size} style={style} {...rest} />

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        borderRadius: '19%',
        backgroundImage: `url(${sprite})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${1536 / 234 * 100}% ${1024 / 218 * 100}%`,
        backgroundPosition: `${tile[0] / (1536 - 234) * 100}% ${tile[1] / (1024 - 218) * 100}%`,
        ...style,
      }}
      {...rest}
    />
  )
}
