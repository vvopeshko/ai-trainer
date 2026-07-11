// FRONTEND_URL поддерживает несколько origin'ов через запятую — на переходный
// период кастомного домена (https://gymwithai.me,https://<проект>.vercel.app).
//
// Первый в списке — канонический: на него строятся ссылки в письмах
// (verify/reset) и редиректы OAuth-handoff. Полный список — разрешённые
// origin'ы для CORS и trustedOrigins Better Auth.

const raw = process.env.FRONTEND_URL || 'http://localhost:5173'

export const FRONTEND_URLS = raw
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

export const FRONTEND_URL = FRONTEND_URLS[0]
