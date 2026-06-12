import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch, apiDelete } from '../utils/api.js'
import { queryKeys } from '../lib/queryKeys.js'

// ─── Cancel (delete) active workout ─────────────────────────────────

export function useCancelWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => apiDelete(`/api/v1/workouts/${id}`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workouts.active })
      const prev = queryClient.getQueryData(queryKeys.workouts.active)
      queryClient.setQueryData(queryKeys.workouts.active, (old) => ({
        ...old,
        workout: null,
        planExercises: null,
        planDayTitle: null,
      }))
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.workouts.active, context.prev)
      }
    },
  })
}

// ─── Resume paused workout ──────────────────────────────────────────

export function useResumeWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }) =>
      apiPatch(`/api/v1/workouts/${id}`, { action: 'resume' }),
    onMutate: async ({ pauseDuration }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workouts.active })
      const prev = queryClient.getQueryData(queryKeys.workouts.active)
      queryClient.setQueryData(queryKeys.workouts.active, (old) => {
        if (!old?.workout) return old
        return {
          ...old,
          workout: {
            ...old.workout,
            pausedAt: null,
            totalPausedMs: (old.workout.totalPausedMs || 0) + (pauseDuration || 0),
          },
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.workouts.active, context.prev)
      }
    },
  })
}

// ─── Finish workout ─────────────────────────────────────────────────

export function useFinishWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) =>
      apiPatch(`/api/v1/workouts/${id}`, { action: 'finish' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workouts.active })
      const prev = queryClient.getQueryData(queryKeys.workouts.active)
      queryClient.setQueryData(queryKeys.workouts.active, (old) => ({
        ...old,
        workout: null,
        planExercises: null,
        planDayTitle: null,
      }))
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.workouts.active, context.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress })
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.next })
    },
  })
}

// ─── Delete a recent workout ────────────────────────────────────────

export function useDeleteWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => apiDelete(`/api/v1/workouts/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workouts.recent })
      const prev = queryClient.getQueryData(queryKeys.workouts.recent)
      queryClient.setQueryData(queryKeys.workouts.recent, (old) =>
        (old || []).filter(w => w.id !== id)
      )
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.workouts.recent, context.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress })
    },
  })
}
