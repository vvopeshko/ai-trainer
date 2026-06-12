/**
 * HomeDataContext — кэш данных Home-экрана.
 *
 * Живёт выше Routes → данные переживают tab-switch.
 * Паттерн stale-while-revalidate: при повторном заходе на Home
 * показываем кэшированные данные, обновляем в фоне.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { apiGet } from '../utils/api.js'
import { syncSettingsFromServer } from '../utils/weightUnit.js'

const HomeDataContext = createContext()

const INITIAL = {
  yearStats: null,
  monthStats: null,
  recent: null,
  activeWorkout: null,
  activePlanExercises: null,
  activePlanDayTitle: null,
  program: null,
  nextWorkout: null,
  loaded: false,
  error: false,
}

export function HomeDataProvider({ children }) {
  const [data, setData] = useState(INITIAL)
  const abortRef = useRef(null)

  const refresh = useCallback(async () => {
    // Отменяем предыдущий запрос — защита от race condition
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const signal = controller.signal

    const [year, month, recentData, active, prog, next, exSettings] = await Promise.all([
      apiGet('/api/v1/stats/year', { signal }).catch(() => null),
      apiGet('/api/v1/stats/month', { signal }).catch(() => null),
      apiGet('/api/v1/workouts/recent?limit=4', { signal }).catch(() => null),
      apiGet('/api/v1/workouts/active', { signal }).catch(() => null),
      apiGet('/api/v1/programs/active', { signal }).catch(() => null),
      apiGet('/api/v1/programs/active/next-workout', { signal }).catch(() => null),
      apiGet('/api/v1/exercises/settings', { signal }).catch(() => null),
    ])

    // Если запрос отменён — не трогаем state
    if (signal.aborted) return

    // Sync exercise settings from server → localStorage
    if (exSettings?.settings) {
      syncSettingsFromServer(exSettings.settings)
    }

    // Если ВСЕ вернули null — ошибка сети
    const allFailed = !year && !month && !recentData && !active && !prog && !next

    setData({
      yearStats: year || { done: 0, target: 208 },
      monthStats: month || { workouts: 0, tonnageKg: 0, streak: 0 },
      recent: recentData?.workouts || [],
      activeWorkout: active?.workout || null,
      activePlanExercises: active?.planExercises || null,
      activePlanDayTitle: active?.planDayTitle || null,
      program: prog?.program || null,
      nextWorkout: next?.day ? next : null,
      loaded: true,
      error: allFailed,
    })
  }, [])

  return (
    <HomeDataContext.Provider value={{ ...data, refresh, setData }}>
      {children}
    </HomeDataContext.Provider>
  )
}

export function useHomeData() {
  return useContext(HomeDataContext)
}
