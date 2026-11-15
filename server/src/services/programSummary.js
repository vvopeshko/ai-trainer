/**
 * Сводка программы для списка «Мои программы»: размер плана и объём по мышцам.
 * Чистая функция; musclesById — { exerciseId: primaryMuscles[] } из каталога.
 * muscleSets — подходы по ключам primaryMuscles (в группы их сворачивает фронт).
 */
export function summarizePlan(planJson, musclesById = {}) {
  const days = planJson?.days ?? []
  const muscleSets = {}
  let exercisesCount = 0
  let setsCount = 0
  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      const sets = ex.sets ?? 0
      exercisesCount += 1
      setsCount += sets
      for (const muscle of musclesById[ex.exerciseId] ?? []) {
        muscleSets[muscle] = (muscleSets[muscle] ?? 0) + sets
      }
    }
  }
  return { daysCount: days.length, exercisesCount, setsCount, muscleSets }
}

/** exerciseId всех программ — одним списком без повторов, для запроса мышц. */
export function planExerciseIds(plans) {
  return [...new Set(plans.flatMap(plan => (plan?.days ?? []).flatMap(day => (day.exercises ?? []).map(ex => ex.exerciseId))))].filter(Boolean)
}
