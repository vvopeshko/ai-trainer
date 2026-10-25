import { apiGet } from '../utils/api.js'
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
