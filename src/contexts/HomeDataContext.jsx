/**
 * HomeDataContext — кэш данных Home-экрана.
 *
 * Живёт выше Routes → данные переживают tab-switch.
 * Паттерн stale-while-revalidate: при повторном заходе на Home
 * показываем кэшированные данные, обновляем в фоне.
 */
import { createContext, useContext, useState, useCallback } from 'react'
import { apiGet } from '../utils/api.js'

const HomeDataContext = createContext()

const INITIAL = {
  yearStats: null,
  monthStats: null,
  recent: null,
  activeWorkout: null,
  program: null,
  nextWorkout: null,
  loaded: false,
}

export function HomeDataProvider({ children }) {
  const [data, setData] = useState(INITIAL)

  const refresh = useCallback(async () => {
    const [year, month, recentData, active, prog, next] = await Promise.all([
      apiGet('/api/v1/stats/year').catch(() => null),
      apiGet('/api/v1/stats/month').catch(() => null),
      apiGet('/api/v1/workouts/recent?limit=4').catch(() => null),
      apiGet('/api/v1/workouts/active').catch(() => null),
      apiGet('/api/v1/programs/active').catch(() => null),
      apiGet('/api/v1/programs/active/next-workout').catch(() => null),
    ])
    setData({
      yearStats: year || { done: 0, target: 208 },
      monthStats: month || { workouts: 0, tonnageKg: 0, streak: 0 },
      recent: recentData?.workouts || [],
      activeWorkout: active?.workout || null,
      program: prog?.program || null,
      nextWorkout: next?.day ? next : null,
      loaded: true,
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
