import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../utils/api.js'
import { syncSettingsFromServer } from '../utils/weightUnit.js'
import { activeWorkoutQueryOptions } from '../lib/activeWorkoutQuery.js'
import { queryKeys } from '../lib/queryKeys.js'

// ─── Stats ───────────────────────────────────────────────────────────

export function useYearStats() {
  return useQuery({
    queryKey: queryKeys.stats.year,
    queryFn: () => apiGet('/api/v1/stats/year'),
    // Без поллинга: счётчик меняется только финишем тренировки,
    // а useFinishWorkout инвалидирует ['stats'].
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
  return useQuery(activeWorkoutQueryOptions())
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

export function programDetailQueryOptions(id) {
  return {
    queryKey: queryKeys.programs.detail(id),
    queryFn: async () => {
      const d = await apiGet('/api/v1/programs/' + id)
      return d.program
    },
    enabled: !!id,
    staleTime: 10 * 60_000,
  }
}

export function useProgramDetail(id) {
  return useQuery(programDetailQueryOptions(id))
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
    // LLM не успела за бюджет бэка — пришёл шаблонный текст, реплика тренера дописывается в фоне
    refetchInterval: (query) => (query.state.data?.pending ? 5000 : false),
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

// Персист каталога (880 упр., ~320 KB) в localStorage: холодный старт мини-аппа
// показывает каталог мгновенно, без скелетона и без 66 KB gzip по сети.
// Версионированный ключ — при смене формы данных или состава каталога бампнуть
// суффикс (v2: слиты дубли — в v1 остались удалённые упражнения, + popularity).
const CATALOG_LS_KEY = 'ai-trainer:catalog-v2'
const STALE_CATALOG_KEYS = ['ai-trainer:catalog-v1']

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
    for (const key of STALE_CATALOG_KEYS) localStorage.removeItem(key)
    localStorage.setItem(CATALOG_LS_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch { /* quota / приватный режим — не критично, просто не кэшируем */ }
}

// Парсим localStorage один раз на сессию (~320 KB JSON — дорого делать в рендере)
let persistedCatalog
function persistedCatalogOnce() {
  if (persistedCatalog === undefined) persistedCatalog = readPersistedCatalog()
  return persistedCatalog
}

// Общие опции: и хук, и idle-prefetch в App создают query одинаково — с гидрацией
// из localStorage. Иначе prefetch без initialData создавал query первым, и
// сохранённый каталог игнорировался (качался заново на каждом старте).
export function exerciseCatalogQueryOptions() {
  return {
    queryKey: queryKeys.exercises.catalog,
    queryFn: async () => {
      const d = await apiGet('/api/v1/exercises?limit=1500')
      const list = d.exercises || []
      writePersistedCatalog(list)
      return list
    },
    staleTime: 24 * 60 * 60_000, // 24 hours
    gcTime: Infinity, // ушли из Library — повторный разбор не нужен
    // Гидрация из localStorage: initialDataUpdatedAt = момент прошлого фетча,
    // поэтому react-query сам решит, свежий ли кэш (нет рефетча) или пора
    // ревалидировать фоном (>24ч) — без мигания скелетона.
    initialData: () => persistedCatalogOnce()?.data,
    initialDataUpdatedAt: () => persistedCatalogOnce()?.ts,
  }
}

export function useExerciseCatalog() {
  return useQuery(exerciseCatalogQueryOptions())
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

export function useExerciseOverview() {
  return useQuery({
    queryKey: queryKeys.exercises.overview,
    queryFn: () => apiGet('/api/v1/exercises/progress-overview'),
    staleTime: 5 * 60_000,
  })
}

export function useExerciseAlternatives(id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.exercises.alternatives(id),
    queryFn: () => apiGet(`/api/v1/exercises/${id}/alternatives`),
    enabled: enabled && !!id,
    staleTime: 10 * 60_000,
  })
}

export function useExerciseHistory(id) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.exercises.history(id),
    queryFn: () => apiGet(`/api/v1/exercises/${id}/history`),
    enabled: !!id,
    staleTime: 60_000,
    // Обзор прогресса уже несёт ту же историю (та же форма сессий) для недавних
    // упражнений — показываем её сразу, пока летит точный запрос
    placeholderData: () => {
      const overview = queryClient.getQueryData(queryKeys.exercises.overview)
      const entry = overview?.exercises?.find(ex => ex.id === id)
      return entry ? { workouts: entry.workouts, hasMore: false, experienceLevel: overview.experienceLevel } : undefined
    },
  })
}
