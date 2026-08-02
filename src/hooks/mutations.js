import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiPatch, apiDelete } from '../utils/api.js'
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
    onSettled: () => {
      // Ресинк с сервером: optimistic-значение могло разойтись с реальностью.
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.active })
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
    onSettled: () => {
      // Optimistic totalPausedMs считается по клиентским часам (clock skew) —
      // после ответа сервера подтягиваем серверную правду.
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.active })
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
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.progress })
      // Удаление сегодняшней тренировки меняет расчёт следующего дня программы.
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.next })
      // Детали закэшированы со staleTime: Infinity — убираем мёртвую запись.
      queryClient.removeQueries({ queryKey: queryKeys.workouts.detail(id) })
    },
  })
}

// ─── Billing (product/ARCHITECTURE_PAYMENTS.md §5.4) ─────────────────

export function useCheckout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planCode, method }) =>
      apiPost('/api/v1/billing/checkout', { planCode, method }),
    onSuccess: (result) => {
      // mock/мгновенные провайдеры: доступ выдан сразу — гейт снимется сам.
      // Для invoice_link/redirect статус доедет рефетчем после оплаты.
      if (result?.type === 'granted') {
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.status })
      }
    },
  })
}

export function useRedeemPromo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code) => apiPost('/api/v1/billing/promo/redeem', { code }),
    onSuccess: (result) => {
      // free_period выдаёт entitlement сразу; discount статус не меняет
      if (result?.kind === 'free_period') {
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.status })
      }
    },
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiPost('/api/v1/billing/cancel'),
    onSuccess: (d) => {
      queryClient.setQueryData(queryKeys.billing.status, d.billing)
    },
  })
}
