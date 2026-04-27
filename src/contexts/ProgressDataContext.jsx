/**
 * ProgressDataContext — кэш данных экрана "Прогресс".
 *
 * Живёт выше Routes → данные переживают tab-switch.
 * Паттерн stale-while-revalidate: при повторном заходе на Progress
 * показываем кэшированные данные, обновляем в фоне.
 */
import { createContext, useContext, useState, useCallback } from 'react'
import { apiGet } from '../utils/api.js'

const ProgressDataContext = createContext()

const INITIAL = {
  state: null,
  planAdherence: null,
  muscleVolume: null,
  records: null,
  loaded: false,
}

export function ProgressDataProvider({ children }) {
  const [data, setData] = useState(INITIAL)

  const refresh = useCallback(async () => {
    const result = await apiGet('/api/v1/progress').catch(() => null)
    if (result) {
      setData({
        state: result.state,
        planAdherence: result.planAdherence,
        muscleVolume: result.muscleVolume,
        records: result.records,
        loaded: true,
      })
    } else {
      setData(prev => ({ ...prev, loaded: true }))
    }
  }, [])

  return (
    <ProgressDataContext.Provider value={{ ...data, refresh }}>
      {children}
    </ProgressDataContext.Provider>
  )
}

export function useProgressData() {
  return useContext(ProgressDataContext)
}
