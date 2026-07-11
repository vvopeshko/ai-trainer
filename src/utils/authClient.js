import { createAuthClient } from 'better-auth/client'
import { genericOAuthClient, oneTimeTokenClient } from 'better-auth/client/plugins'
import { tokenStorage } from './tokenStorage.js'

// Клиент Better Auth (web-платформа). Bearer-паттерн: токен приходит
// в заголовке ответа set-auth-token (сервер обязан отдавать его в
// CORS exposedHeaders) и уходит в Authorization: Bearer.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    genericOAuthClient(), // Yandex (включается credentials'ами на сервере)
    oneTimeTokenClient(), // возврат из OAuth-редиректа (handoff)
  ],
  fetchOptions: {
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get('set-auth-token')
      if (token) tokenStorage.set(token)
    },
    auth: { type: 'Bearer', token: () => tokenStorage.get() || '' },
  },
})
