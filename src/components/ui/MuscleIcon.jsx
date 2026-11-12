import lowerBack from '../../assets/muscles/lower-back.webp'
import middleBack from '../../assets/muscles/middle-back.webp'
import obliques from '../../assets/muscles/obliques.webp'
import abductors from '../../assets/muscles/abductors.webp'
import neck from '../../assets/muscles/neck.webp'
import frontDelt from '../../assets/muscles/front-delt.webp'
import sideDelt from '../../assets/muscles/side-delt.webp'
import rearDelt from '../../assets/muscles/rear-delt.webp'
import upperChest from '../../assets/muscles/upper-chest.webp'
import midChest from '../../assets/muscles/mid-chest.webp'
import lowerChest from '../../assets/muscles/lower-chest.webp'
import { Icon } from './Icon.jsx'
import chest from '../../assets/muscles/chest.webp'
import back from '../../assets/muscles/back.webp'
import shoulder from '../../assets/muscles/shoulder.webp'
import arm from '../../assets/muscles/arm.webp'
import leg from '../../assets/muscles/leg.webp'
import hamstrings from '../../assets/muscles/hamstrings.png'
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

const IMAGES = {
  lowerBack, middleBack, obliques, abductors, neck, frontDelt, sideDelt, rearDelt, upperChest, midChest, lowerChest, chest, back, shoulder, arm, leg, hamstrings, abs, glutes, lats, traps, forearms, biceps, triceps, delts, calves, adductors }
const ALIASES = {
  shoulders: 'shoulder', arms: 'arm', legs: 'leg', core: 'abs',
  abdominals: 'abs', quadriceps: 'leg', quads: 'leg',
  upper_chest: 'upperChest', mid_chest: 'midChest', lower_chest: 'lowerChest',
  front_delt: 'frontDelt', side_delt: 'sideDelt', rear_delt: 'rearDelt',
  front_delts: 'frontDelt', side_delts: 'sideDelt', rear_delts: 'rearDelt',
  'middle back': 'middleBack', 'lower back': 'lowerBack', middle_back: 'middleBack', lower_back: 'lowerBack', upper_back: 'back',
  'Грудь': 'chest', 'Спина': 'back', 'Плечи': 'shoulder', 'Руки': 'arm',
  'Ноги': 'leg', 'Пресс': 'abs', 'Бицепс': 'biceps', 'Трицепс': 'triceps', 'Предплечья': 'forearms',
  'Ягодицы': 'glutes', 'Широчайшие': 'lats', 'Трапеции': 'traps', 'Дельты': 'delts', 'Икры': 'calves', 'Приводящие': 'adductors',
}

export function MuscleIcon({ name, size = 40, style, ...rest }) {
  const key = ALIASES[name] || name
  const image = Object.hasOwn(IMAGES, key) ? IMAGES[key] : null
  if (!image) return <Icon name="activity" size={size} aria-hidden="true" style={style} {...rest} />

  return <img src={image} alt="" aria-hidden="true" width={size} height={size} draggable={false}
    style={{ display: 'inline-block', width: size, height: size, flexShrink: 0, borderRadius: '19%', objectFit: 'fill', ...style }}
    {...rest} />
}
