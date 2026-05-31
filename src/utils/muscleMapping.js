/**
 * Маппинги мышц: slug → группа / русское название.
 * Используется в ProgramEditPage и ProgressPage.
 */

export const MUSCLE_GROUP = {
  chest: 'Грудь', upper_chest: 'Грудь', mid_chest: 'Грудь', lower_chest: 'Грудь',
  back: 'Спина', lats: 'Спина', upper_back: 'Спина', middle_back: 'Спина',
  traps: 'Спина',
  shoulders: 'Плечи', front_delts: 'Плечи', side_delts: 'Плечи', rear_delts: 'Плечи',
  biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предплечья',
  quads: 'Ноги', quadriceps: 'Ноги', hamstrings: 'Ноги', glutes: 'Ноги',
  calves: 'Ноги', adductors: 'Ноги', abductors: 'Ноги',
  abs: 'Пресс', abdominals: 'Пресс', core: 'Пресс',
}

export const MUSCLE_NAME = {
  chest: 'грудь', upper_chest: 'верх груди', mid_chest: 'середина груди', lower_chest: 'низ груди',
  back: 'спина', lats: 'широчайшие', upper_back: 'верх спины', middle_back: 'середина спины',
  traps: 'трапеции',
  shoulders: 'плечи', front_delts: 'передние дельты', side_delts: 'средние дельты', rear_delts: 'задние дельты',
  biceps: 'бицепс', triceps: 'трицепс', forearms: 'предплечья',
  quads: 'квадрицепс', quadriceps: 'квадрицепс', hamstrings: 'бицепс бедра', glutes: 'ягодицы',
  calves: 'икры', adductors: 'приводящие', abductors: 'отводящие',
  abs: 'пресс', abdominals: 'пресс', core: 'кор',
}

export function getMuscleGroup(key) {
  return MUSCLE_GROUP[key] || key
}

export function getMuscleName(key) {
  return MUSCLE_NAME[key] || key
}

export const EQUIPMENT_NAME = {
  barbell: 'штанга', dumbbell: 'гантели', 'body only': 'своё тело',
  cable: 'тренажёр', machine: 'тренажёр', kettlebells: 'гиря',
  bands: 'резинка', 'e-z curl bar': 'EZ-гриф', 'foam roll': 'ролл',
  other: 'другое', medicine_ball: 'медбол',
}

export function getEquipmentName(key) {
  return EQUIPMENT_NAME[key] || key
}
