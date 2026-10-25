import { apiGet, apiPatch } from './api.js'

// Returns the last server-confirmed state even when a PATCH response is lost.
// Never infer pause timestamps from client clocks.
export async function changeWorkoutPause(id, action, pendingSets = []) {
  await Promise.allSettled(pendingSets)
  try {
    const { workout } = await apiPatch(`/api/v1/workouts/${id}`, { action })
    return { workout, failed: false }
  } catch {
    try {
      const { workout } = await apiGet('/api/v1/workouts/active')
      return { workout: workout?.id === id ? workout : null, failed: true }
    } catch {
      return { workout: null, failed: true }
    }
  }
}
