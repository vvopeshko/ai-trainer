import { isPremium } from '../services/billing/billingService.js'

// Hard paywall (product/ARCHITECTURE_PAYMENTS.md §5.3): данные-роуты за подпиской.
// Монтируется в route-файлах СРАЗУ ПОСЛЕ auth (нужен req.user).
// Свободны только /auth/*, /billing/* и /admin (свой гейт).
//
// PREMIUM_GATING=off (дефолт) — гейт выключен: код в проде, продажа и гейтинг
// включаются независимо. Fail-closed не нужен: без подписочной механики
// приложение должно работать как раньше.
//
// Клиент при 403 { code: 'PREMIUM_REQUIRED' } инвалидирует queryKeys.billing —
// paywall-гейт на фронте срабатывает сам.
export async function requirePremium(req, res, next) {
  if (process.env.PREMIUM_GATING !== 'on') return next()
  try {
    if (await isPremium(req.user.id)) return next()
    return res.status(403).json({ error: 'Требуется подписка', code: 'PREMIUM_REQUIRED' })
  } catch (err) {
    return next(err)
  }
}
