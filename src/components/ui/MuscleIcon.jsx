import { Icon } from './Icon.jsx'
import chest from '../../assets/muscles/chest.webp'
import back from '../../assets/muscles/back.webp'
import shoulder from '../../assets/muscles/shoulder.webp'
import arm from '../../assets/muscles/arm.webp'
import leg from '../../assets/muscles/leg.webp'
import abs from '../../assets/muscles/abs.webp'
import glutes from '../../assets/muscles/glutes.webp'
import lats from '../../assets/muscles/lats.webp'
import traps from '../../assets/muscles/traps.webp'
import forearms from '../../assets/muscles/forearms.webp'
import biceps from '../../assets/muscles/biceps.webp'
import triceps from '../../assets/muscles/triceps.webp'
import delts from '../../assets/muscles/delts.webp'
import calves from '../../assets/muscles/calves.webp'
import adductors from '../../assets/muscles/adductors.webp'

const IMAGES = { chest, back, shoulder, arm, leg, abs, glutes, lats, traps, forearms, biceps, triceps, delts, calves, adductors }
const ALIASES = {
  shoulders: 'shoulder', arms: 'arm', legs: 'leg', core: 'abs',
  abdominals: 'abs', obliques: 'abs', quadriceps: 'leg', quads: 'leg',
  upper_chest: 'chest', mid_chest: 'chest', lower_chest: 'chest',
  front_delt: 'delts', side_delt: 'delts', rear_delt: 'delts',
  front_delts: 'delts', side_delts: 'delts', rear_delts: 'delts',
  'middle back': 'back', 'lower back': 'back', middle_back: 'back', lower_back: 'back', upper_back: 'back',
  'Грудь': 'chest', 'Спина': 'back', 'Плечи': 'shoulder', 'Руки': 'arm',
  'Ноги': 'leg', 'Пресс': 'abs', 'Бицепс': 'biceps', 'Трицепс': 'triceps', 'Предплечья': 'forearms',
  'Ягодицы': 'glutes', 'Широчайшие': 'lats', 'Трапеции': 'traps', 'Дельты': 'delts', 'Икры': 'calves', 'Приводящие': 'adductors',
}

export function MuscleIcon({ name, size = 40, style, ...rest }) {
  const key = ALIASES[name] || name
  const image = Object.hasOwn(IMAGES, key) ? IMAGES[key] : null
  // These groups have no dedicated artwork: don't highlight the front thigh
  // for a posterior-thigh or outer-hip exercise.
  const fallback = name === 'hamstrings' || name === 'abductors' ? 'leg' : 'activity'
  if (!image) return <Icon name={fallback} size={size} aria-hidden="true" style={style} {...rest} />

  return <img src={image} alt="" aria-hidden="true" width={size} height={size} draggable={false}
    style={{ display: 'inline-block', width: size, height: size, flexShrink: 0, borderRadius: '19%', objectFit: 'fill', ...style }}
    {...rest} />
}
