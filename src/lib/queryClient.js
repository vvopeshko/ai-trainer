import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Telegram WebView triggers focus on minimize
      retry: 1,
      staleTime: 5 * 60_000, // 5 min default
    },
  },
})
