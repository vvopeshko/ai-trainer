import { dehydrate, hydrate } from '@tanstack/react-query'
import { queryKeys } from './queryKeys.js'

// Персист кэша TanStack Query в localStorage: холодный старт мини-аппа сразу
// показывает прошлые данные (Home, Progress, программа), а свежие подтягиваются
// фоном — вместо скелетонов на каждом открытии.
//
// - Ключ хранилища — по юзеру: на общем устройстве (web) чужие данные не всплывут.
// - Только белый список небольших ключей; каталог упражнений персистится сам
//   (queries.js), детали/история по id — нет (их много, растут без границ).
// - Восстановленные данные «стареют» по своему dataUpdatedAt: staleTime решает,
//   нужен ли фоновый рефетч, как будто вкладка и не закрывалась.
// Версию (v1) бампнуть при смене формы ответа любого из ключей ниже.

const PREFIX = 'ai-trainer:rq-v1:'
const MAX_AGE_MS = 24 * 60 * 60_000
const WRITE_THROTTLE_MS = 1000

const PERSISTED_KEYS = [
  queryKeys.stats.year,
  queryKeys.stats.month,
  queryKeys.workouts.recent,
  queryKeys.workouts.active,
  queryKeys.programs.active,
  queryKeys.programs.next,
  queryKeys.programs.list,
  queryKeys.progress,
  queryKeys.insights.today,
  queryKeys.insights.progress,
  queryKeys.exercises.settings,
  queryKeys.exercises.overview,
  queryKeys.billing.status,
].map((key) => JSON.stringify(key))

function storageKey(userId) {
  return `${PREFIX}${userId}`
}

export function shouldPersistQuery(query) {
  return query.state.status === 'success'
    && query.state.data !== undefined
    // pending-инсайт — промежуточный ответ, после рестарта нужен настоящий
    && !query.state.data?.pending
    && PERSISTED_KEYS.includes(JSON.stringify(query.queryKey))
}

/** Синхронно вливает сохранённый кэш юзера в queryClient (до первого рендера экранов). */
export function restoreQueries(queryClient, userId) {
  try {
    // Чужие сохранённые кэши (другой аккаунт на этом устройстве) — удаляем
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX) && key !== storageKey(userId)) localStorage.removeItem(key)
    }
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return
    const { ts, state } = JSON.parse(raw)
    if (!ts || Date.now() - ts > MAX_AGE_MS) {
      localStorage.removeItem(storageKey(userId))
      return
    }
    // hydrate не перетирает более свежие данные, уже лежащие в кэше
    hydrate(queryClient, state)
  } catch { /* битый JSON / недоступный storage — просто стартуем с пустым кэшем */ }
}

/** Пишет белый список в localStorage при изменениях кэша (с троттлингом). */
export function subscribePersistence(queryClient, userId) {
  let timer = null
  const write = () => {
    timer = null
    try {
      const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersistQuery })
      localStorage.setItem(storageKey(userId), JSON.stringify({ ts: Date.now(), state }))
    } catch { /* quota / приватный режим — не критично */ }
  }
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' && event.type !== 'removed') return
    if (!timer) timer = setTimeout(write, WRITE_THROTTLE_MS)
  })
  return () => {
    unsubscribe()
    if (timer) {
      clearTimeout(timer)
      write()
    }
  }
}

/** Выход из аккаунта: сохранённые кэши всех юзеров этого устройства — прочь. */
export function clearPersistedQueries() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch { /* ignore */ }
}
