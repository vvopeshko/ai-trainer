import { apiGet, apiPost } from '../utils/api.js'
import { queryKeys } from './queryKeys.js'

// Only this read gets a longer startup budget. Never retry writes: a timed-out
// POST/PATCH could already have committed on the server.
export function activeWorkoutQueryOptions() {
  return {
    queryKey: queryKeys.workouts.active,
    queryFn: ({ signal }) => apiGet('/api/v1/workouts/active', { signal, timeout: 30_000 }),
    staleTime: 30_000,
    retry: (failureCount, error) => failureCount < 1 && (
      error instanceof TypeError
      || ['AbortError', 'TimeoutError'].includes(error?.name)
      || [500, 502, 503, 504].includes(error?.status)
    ),
    retryDelay: 1000,
  }
}

export function fetchActiveWorkout(queryClient) {
  // Ignore stale Home snapshots but share any in-flight read. Query cancellation
  // is managed by QueryClient, not by a page unmount that might affect Home.
  return queryClient.fetchQuery({ ...activeWorkoutQueryOptions(), staleTime: 0 })
}

// Кэш активной тренировки — источник мгновенного рендера WorkoutPage, поэтому
// держим в нём подходы актуальными: добавленный/удалённый на странице сет
// сразу отражается в кэше (без ожидания рефетча).
export function patchActiveWorkoutSets(queryClient, workoutId, update) {
  queryClient.setQueryData(queryKeys.workouts.active, (old) => {
    if (!old?.workout || old.workout.id !== workoutId) return old
    return { ...old, workout: { ...old.workout, sets: update(old.workout.sets ?? []) } }
  })
}

// Отпечаток серверного состояния: совпал — фоновая сверка ничего не меняет.
export function activeWorkoutSignature(data) {
  const w = data?.workout
  if (!w) return 'none'
  return JSON.stringify([
    w.id, w.pausedAt ?? null, w.totalPausedMs ?? 0, w.programDayIndex ?? null,
    (w.sets ?? []).map((s) => s.id),
    (data.planExercises ?? []).map((pe) => pe.exerciseId),
  ])
}

// Старт тренировки: ответ POST — та же форма, что GET /active (тренировка + план
// дня), кладём его в кэш, и WorkoutPage открывается без запроса и скелетона.
// Есть незавершённая — сервер вернёт её (resumed), а не создаст вторую.
export async function startWorkout(queryClient, { programId, programDayIndex } = {}) {
  const body = programId ? { programId, programDayIndex } : {}
  const { workout, planExercises, planDayTitle } = await apiPost('/api/v1/workouts', body)
  const payload = { workout, planExercises, planDayTitle }
  queryClient.setQueryData(queryKeys.workouts.active, payload)
  return payload
}
