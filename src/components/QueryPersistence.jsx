import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTelegram } from './TelegramProvider.jsx'
import { restoreQueries, subscribePersistence } from '../lib/queryPersistence.js'

// Восстанавливает сохранённый кэш юзера ДО рендера экранов (синхронно, в render),
// чтобы первый же useQuery увидел данные, и подписывается на запись изменений.
// Юзер неизвестен (web без сессии / сеть упала) — персист выключен.
export function QueryPersistence({ children }) {
  const queryClient = useQueryClient()
  const { user } = useTelegram()
  const userId = user?.id != null ? String(user.id) : null

  // Паттерн «состояние от пропса»: юзер сменился — вливаем его кэш в этом же
  // рендере (hydrate идемпотентен, повтор в StrictMode безвреден)
  const [restoredFor, setRestoredFor] = useState(null)
  if (userId && restoredFor !== userId) {
    // Сменился аккаунт в живой сессии — данные прежнего не должны всплыть
    if (restoredFor) queryClient.clear()
    restoreQueries(queryClient, userId)
    setRestoredFor(userId)
  }

  useEffect(() => {
    if (!userId) return
    return subscribePersistence(queryClient, userId)
  }, [queryClient, userId])

  return children
}
