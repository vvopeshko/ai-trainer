/**
 * Маппинги мышц: серверный muscle ID → группа / русское название.
 * Используется в ProgramEditPage, ProgressPage, SummaryPage, ExerciseDetailSheet.
 *
 * Канонические ID — то, что реально шлёт сервер:
 * - Exercise.primaryMuscles/secondaryMuscles (free-exercise-db):
 *   chest, lats, 'middle back', 'lower back', traps, shoulders, biceps, triceps,
 *   forearms, quadriceps, hamstrings, glutes, calves, adductors, abductors,
 *   abdominals, obliques, neck
 * - sub-muscle ключи из statsService (EXERCISE_MUSCLE_OVERRIDE):
 *   upper_chest, mid_chest, lower_chest, front_delt, side_delt, rear_delt
 *
 * Плюс алиасы старых/альтернативных форм (front_delts, middle_back, quads, abs…),
 * чтобы данные из старых location.state / planJson не выпадали.
 */

export const MUSCLE_GROUP = {
  // Грудь
  chest: 'Грудь', upper_chest: 'Грудь', mid_chest: 'Грудь', lower_chest: 'Грудь',
  // Спина
  back: 'Спина', lats: 'Спина', upper_back: 'Спина',
  'middle back': 'Спина', 'lower back': 'Спина', traps: 'Спина',
  // Плечи
  shoulders: 'Плечи', front_delt: 'Плечи', side_delt: 'Плечи', rear_delt: 'Плечи',
  // Руки
  biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предплечья',
  // Ноги
  quadriceps: 'Ноги', hamstrings: 'Ноги', glutes: 'Ноги',
  calves: 'Ноги', adductors: 'Ноги', abductors: 'Ноги',
  // Пресс
  abdominals: 'Пресс', obliques: 'Пресс',
  // Прочее
  neck: 'Шея',
  // ── Алиасы старых форм (не серверные ID, оставлены для обратной совместимости) ──
  front_delts: 'Плечи', side_delts: 'Плечи', rear_delts: 'Плечи',
  middle_back: 'Спина', lower_back: 'Спина',
  quads: 'Ноги', abs: 'Пресс', core: 'Пресс',
}

export const MUSCLE_NAME = {
  // Грудь
  chest: 'грудь', upper_chest: 'верх груди', mid_chest: 'середина груди', lower_chest: 'низ груди',
  // Спина
  back: 'спина', lats: 'широчайшие', upper_back: 'верх спины',
  'middle back': 'середина спины', 'lower back': 'поясница', traps: 'трапеции',
  // Плечи
  shoulders: 'плечи', front_delt: 'передние дельты', side_delt: 'средние дельты', rear_delt: 'задние дельты',
  // Руки
  biceps: 'бицепс', triceps: 'трицепс', forearms: 'предплечья',
  // Ноги
  quadriceps: 'квадрицепс', hamstrings: 'бицепс бедра', glutes: 'ягодицы',
  calves: 'икры', adductors: 'приводящие', abductors: 'отводящие',
  // Пресс
  abdominals: 'пресс', obliques: 'косые',
  // Прочее
  neck: 'шея',
  // ── Алиасы старых форм ──
  front_delts: 'передние дельты', side_delts: 'средние дельты', rear_delts: 'задние дельты',
  middle_back: 'середина спины', lower_back: 'поясница',
  quads: 'квадрицепс', abs: 'пресс', core: 'кор',
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
  'exercise ball': 'фитбол', 'medicine ball': 'медбол',
  other: 'другое', medicine_ball: 'медбол',
}

export function getEquipmentName(key) {
  return EQUIPMENT_NAME[key] || key
}
