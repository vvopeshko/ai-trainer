import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Telegram WebView triggers focus on minimize
      retry: 1,
      staleTime: 5 * 60_000, // 5 min default
      // Данные без подписчиков живут сутки (не 5 мин): за долгую тренировку
      // Progress/Me не выкидываются, и персист (lib/queryPersistence.js) их не теряет
      gcTime: 24 * 60 * 60_000,
    },
  },
})
