import { describe, it, expect } from 'vitest'
import { getMuscleGroup, getMuscleName, MUSCLE_GROUP, MUSCLE_NAME } from './muscleMapping.js'

/**
 * Канонический список muscle ID, которые шлёт сервер.
 * Зафиксирован по server/src/services/statsService.js (MUSCLE_GROUP_MAP +
 * EXERCISE_MUSCLE_OVERRIDE) и фактическим значениям Exercise.primaryMuscles
 * в server/data/enriched-exercises.json.
 * Если сервер добавит новый ID — этот тест поймает рассинхрон.
 */
const SERVER_MUSCLE_IDS = [
  // Значения primaryMuscles/secondaryMuscles из базы (free-exercise-db)
  'chest', 'lats', 'middle back', 'lower back', 'traps', 'shoulders',
  'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors',
  'abdominals', 'obliques', 'neck',
  // Sub-muscle ключи из statsService.EXERCISE_MUSCLE_OVERRIDE
  'upper_chest', 'mid_chest', 'lower_chest',
  'front_delt', 'side_delt', 'rear_delt',
]

describe('server muscle IDs invariant', () => {
  it('every server muscle ID has a Russian name', () => {
    for (const id of SERVER_MUSCLE_IDS) {
      expect(MUSCLE_NAME, `MUSCLE_NAME missing "${id}"`).toHaveProperty([id])
      expect(getMuscleName(id)).not.toBe(id) // не сырой ID
    }
  })

  it('every server muscle ID has a group', () => {
    for (const id of SERVER_MUSCLE_IDS) {
      expect(MUSCLE_GROUP, `MUSCLE_GROUP missing "${id}"`).toHaveProperty([id])
      expect(getMuscleGroup(id)).not.toBe(id) // не сырой ID
    }
  })
})

describe('getMuscleGroup', () => {
  it('returns group for known muscle slugs', () => {
    expect(getMuscleGroup('chest')).toBe('Грудь')
    expect(getMuscleGroup('lats')).toBe('Спина')
    expect(getMuscleGroup('biceps')).toBe('Бицепс')
    expect(getMuscleGroup('quadriceps')).toBe('Ноги')
    expect(getMuscleGroup('abdominals')).toBe('Пресс')
  })

  it('maps server sub-muscle IDs to their parent group', () => {
    expect(getMuscleGroup('upper_chest')).toBe('Грудь')
    expect(getMuscleGroup('front_delt')).toBe('Плечи')
    expect(getMuscleGroup('side_delt')).toBe('Плечи')
    expect(getMuscleGroup('rear_delt')).toBe('Плечи')
    expect(getMuscleGroup('middle back')).toBe('Спина')
    expect(getMuscleGroup('hamstrings')).toBe('Ноги')
  })

  it('supports legacy aliases (old client-side forms)', () => {
    expect(getMuscleGroup('front_delts')).toBe('Плечи')
    expect(getMuscleGroup('side_delts')).toBe('Плечи')
    expect(getMuscleGroup('rear_delts')).toBe('Плечи')
    expect(getMuscleGroup('middle_back')).toBe('Спина')
    expect(getMuscleGroup('quads')).toBe('Ноги')
    expect(getMuscleGroup('abs')).toBe('Пресс')
    expect(getMuscleGroup('core')).toBe('Пресс')
  })

  it('returns the key itself for unknown slugs (passthrough)', () => {
    expect(getMuscleGroup('unknown_muscle')).toBe('unknown_muscle')
  })
})

describe('getMuscleName', () => {
  it('returns Russian name for known muscle slugs', () => {
    expect(getMuscleName('chest')).toBe('грудь')
    expect(getMuscleName('lats')).toBe('широчайшие')
    expect(getMuscleName('triceps')).toBe('трицепс')
    expect(getMuscleName('middle back')).toBe('середина спины')
    expect(getMuscleName('front_delt')).toBe('передние дельты')
  })

  it('legacy aliases resolve to the same names as server IDs', () => {
    expect(getMuscleName('front_delts')).toBe(getMuscleName('front_delt'))
    expect(getMuscleName('side_delts')).toBe(getMuscleName('side_delt'))
    expect(getMuscleName('rear_delts')).toBe(getMuscleName('rear_delt'))
    expect(getMuscleName('middle_back')).toBe(getMuscleName('middle back'))
  })

  it('returns the key itself for unknown slugs (passthrough)', () => {
    expect(getMuscleName('unknown')).toBe('unknown')
  })

  it('handles all defined muscle names', () => {
    for (const [key, value] of Object.entries(MUSCLE_NAME)) {
      expect(getMuscleName(key)).toBe(value)
    }
  })
})

describe('MUSCLE_GROUP mapping completeness', () => {
  it('every key in MUSCLE_NAME also exists in MUSCLE_GROUP', () => {
    for (const key of Object.keys(MUSCLE_NAME)) {
      expect(MUSCLE_GROUP, `MUSCLE_GROUP missing "${key}"`).toHaveProperty([key])
    }
  })

  it('every key in MUSCLE_GROUP also exists in MUSCLE_NAME', () => {
    for (const key of Object.keys(MUSCLE_GROUP)) {
      expect(MUSCLE_NAME, `MUSCLE_NAME missing "${key}"`).toHaveProperty([key])
    }
  })
})
