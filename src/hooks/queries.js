import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../utils/api.js'
import { syncSettingsFromServer } from '../utils/weightUnit.js'
import { queryKeys } from '../lib/queryKeys.js'

// ─── Stats ───────────────────────────────────────────────────────────

export function useYearStats() {
  return useQuery({
    queryKey: queryKeys.stats.year,
    queryFn: () => apiGet('/api/v1/stats/year'),
  })
}

export function useMonthStats() {
  return useQuery({
    queryKey: queryKeys.stats.month,
    queryFn: () => apiGet('/api/v1/stats/month'),
  })
}

// ─── Workouts ────────────────────────────────────────────────────────

export function useRecentWorkouts() {
  return useQuery({
    queryKey: queryKeys.workouts.recent,
    queryFn: async () => {
      const d = await apiGet('/api/v1/workouts/recent?limit=4')
      return d.workouts || []
    },
  })
}

export function useActiveWorkoutQuery() {
  return useQuery({
    queryKey: queryKeys.workouts.active,
    queryFn: () => apiGet('/api/v1/workouts/active'),
    staleTime: 30_000, // 30 sec — critical for resume
  })
}

export function useWorkoutDetail(id) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(id),
    queryFn: () => apiGet(`/api/v1/workouts/${id}`),
    enabled: !!id,
    staleTime: Infinity, // finished workouts don't change
  })
}

// ─── Programs ────────────────────────────────────────────────────────

export function useActiveProgram() {
  return useQuery({
    queryKey: queryKeys.programs.active,
    queryFn: async () => {
      const d = await apiGet('/api/v1/programs/active')
      return d.program || null
    },
    staleTime: 10 * 60_000,
  })
}

export function useNextWorkout() {
  return useQuery({
    queryKey: queryKeys.programs.next,
    queryFn: async () => {
      const d = await apiGet('/api/v1/programs/active/next-workout')
      return d?.day ? d : null
    },
  })
}

export function useProgramList() {
  return useQuery({
    queryKey: queryKeys.programs.list,
    queryFn: async () => {
      const d = await apiGet('/api/v1/programs')
      return d.programs || []
    },
    staleTime: 10 * 60_000,
  })
}

export function useProgramDetail(id) {
  return useQuery({
    queryKey: queryKeys.programs.detail(id),
    queryFn: async () => {
      const d = await apiGet('/api/v1/programs/' + id)
      return d.program
    },
    enabled: !!id,
    staleTime: 10 * 60_000,
  })
}

// ─── Progress ────────────────────────────────────────────────────────

export function useProgress() {
  return useQuery({
    queryKey: queryKeys.progress,
    queryFn: () => apiGet('/api/v1/progress'),
  })
}

// ─── Insights (фаза 4) ───────────────────────────────────────────────

export function useDailyInsight() {
  return useQuery({
    queryKey: queryKeys.insights.today,
    queryFn: () => apiGet('/api/v1/insights/today'),
    staleTime: 30 * 60_000, // 30 min — генерится раз в день, кэш на бэке
  })
}

export function useProgressInsights() {
  return useQuery({
    queryKey: queryKeys.insights.progress,
    queryFn: () => apiGet('/api/v1/progress/insights'),
    staleTime: 5 * 60_000,
  })
}

// ─── Exercises ───────────────────────────────────────────────────────

export function useExerciseSettings() {
  return useQuery({
    queryKey: queryKeys.exercises.settings,
    queryFn: async () => {
      const d = await apiGet('/api/v1/exercises/settings')
      if (d?.settings) syncSettingsFromServer(d.settings)
      return d
    },
    staleTime: 30 * 60_000, // 30 min
  })
}

// Персист каталога (924 упр., ~320 KB) в localStorage: холодный старт мини-аппа
// показывает каталог мгновенно, без скелетона и без 66 KB gzip по сети.
// Версионированный ключ — при смене формы данных бампнуть суффикс.
const CATALOG_LS_KEY = 'ai-trainer:catalog-v1'

function readPersistedCatalog() {
  try {
    const raw = localStorage.getItem(CATALOG_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.data) ? parsed : null // { ts, data }
  } catch { return null }
}

function writePersistedCatalog(data) {
  try {
    localStorage.setItem(CATALOG_LS_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch { /* quota / приватный режим — не критично, просто не кэшируем */ }
}

export function useExerciseCatalog() {
  return useQuery({
    queryKey: queryKeys.exercises.catalog,
    queryFn: async () => {
      const d = await apiGet('/api/v1/exercises?limit=1500')
      const list = d.exercises || []
      writePersistedCatalog(list)
      return list
    },
    staleTime: 24 * 60 * 60_000, // 24 hours
    // Гидрация из localStorage: initialDataUpdatedAt = момент прошлого фетча,
    // поэтому react-query сам решит, свежий ли кэш (нет рефетча) или пора
    // ревалидировать фоном (>24ч) — без мигания скелетона.
    initialData: () => readPersistedCatalog()?.data,
    initialDataUpdatedAt: () => readPersistedCatalog()?.ts,
  })
}

export function useExerciseDetail(exerciseId) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.exercises.detail(exerciseId),
    queryFn: async () => {
      const d = await apiGet(`/api/v1/exercises/${exerciseId}`)
      return d.exercise
    },
    enabled: !!exerciseId,
    staleTime: 24 * 60 * 60_000,
    placeholderData: () => {
      // Try to find basic data from catalog cache
      const catalog = queryClient.getQueryData(queryKeys.exercises.catalog)
      return catalog?.find(ex => ex.id === exerciseId) ?? undefined
    },
  })
}

// ─── Billing (product/ARCHITECTURE_PAYMENTS.md §5.4) ─────────────────

export function useBillingStatus() {
  return useQuery({
    queryKey: queryKeys.billing.status,
    queryFn: async () => {
      const d = await apiGet('/api/v1/billing/status')
      return d.billing
    },
    staleTime: 60_000, // статус меняют только мутации (они инвалидируют) и оплата извне
  })
}

export function useBillingPlans(enabled = true) {
  return useQuery({
    queryKey: queryKeys.billing.plans,
    queryFn: () => apiGet('/api/v1/billing/plans'),
    enabled, // грузится только при показе paywall'а (сервер трекает paywall_shown)
    staleTime: 10 * 60_000,
  })
}
