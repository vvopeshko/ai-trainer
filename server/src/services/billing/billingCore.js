// ======================================
// Ядро биллинга — чистая логика без prisma/env (тестируется на значениях)
// ======================================
//
// Правила из product/ARCHITECTURE_PAYMENTS.md:
//   §4 — активность: status active|canceled|past_due И (lifetime ИЛИ periodEnd + grace > now)
//   §5.1 — продление: max(now, currentPeriodEnd) + период (складывается, не сгорает);
//          lifetime (currentPeriodEnd = null) поглощает любые периоды
//   §5.2 — регион: ценовая корзина, не страна; страна (geoip) побеждает язык

const DAY_MS = 24 * 60 * 60 * 1000

// lifetime периода в днях не имеет — грант обнуляет currentPeriodEnd
export const PERIOD_DAYS = { week: 7, month: 30 }
export const DEFAULT_REGION = 'default'

// Статусы, при которых подписка даёт доступ (past_due — grace на время ретраев)
const ACTIVE_STATUSES = new Set(['active', 'canceled', 'past_due'])

// Провайдеры, которые продлеваются на нашей стороне или не продлеваются вовсе.
// «Толстые» (tribute/paddle/IAP) владеют своим жизненным циклом — отмена уходит к ним.
export const LOCAL_PROVIDERS = new Set(['yookassa', 'mock'])
export const FREE_PROVIDERS = new Set(['promo', 'admin'])

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS)
}

// Продление: периоды складываются — покупка месяца при живой неделе ничего не сжигает
export function computeNewPeriodEnd({ currentPeriodEnd, days, now = new Date() }) {
  const base = currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now
  return addDays(base, days)
}

export function isSubscriptionActive(sub, { now = new Date(), graceHours = 24 } = {}) {
  if (!sub) return false
  if (!ACTIVE_STATUSES.has(sub.status)) return false
  if (sub.currentPeriodEnd == null) return true // lifetime
  const graceMs = graceHours * 60 * 60 * 1000
  return sub.currentPeriodEnd.getTime() + graceMs > now.getTime()
}

export function isLifetime(sub) {
  return Boolean(sub) && sub.currentPeriodEnd == null && ACTIVE_STATUSES.has(sub.status)
}

// ======================================
// Регион (ценовая корзина)
// ======================================
//
// Страна из geoip (фаза 3, пока null) побеждает язык; язык — fallback для
// Telegram-клиентов, где IP может быть прокси. Корзин пока две: 'ru' | 'default'.
const RU_COUNTRIES = new Set(['RU'])

export function resolvePriceRegion({ countryCode = null, languageCode = null } = {}) {
  if (countryCode) {
    return RU_COUNTRIES.has(countryCode.toUpperCase()) ? 'ru' : DEFAULT_REGION
  }
  if (languageCode && String(languageCode).toLowerCase().startsWith('ru')) return 'ru'
  return DEFAULT_REGION
}

// ======================================
// Выбор цены и методов оплаты
// ======================================

// prices — все строки плана; fallback: точный регион → 'default'.
// null = у метода нет цены на этот план (например, lifetime у tribute) — метод скрывается.
export function pickPrice(prices, provider, region) {
  const forProvider = prices.filter((p) => p.provider === provider)
  return (
    forProvider.find((p) => p.region === region) ||
    forProvider.find((p) => p.region === DEFAULT_REGION) ||
    null
  )
}

// Матрица «платформа × регион → методы» (§3), порядок = приоритет на paywall'е.
// enabled — фиче-флаги из PAYMENT_PROVIDERS (паттерн AUTH_PROVIDERS).
export function availableMethods({ platform, tmaClient = null, region, enabled }) {
  let ordered
  if (platform === 'telegram') {
    if (tmaClient === 'ios') {
      // Требование Apple: цифровые товары в TMA внутри iOS-клиента — только Stars
      ordered = ['stars']
    } else if (region === 'ru') {
      ordered = ['tribute', 'stars']
    } else {
      ordered = ['stars', 'paddle']
    }
  } else {
    // web/PWA (в т.ч. будущая мобилка до IAP)
    ordered = region === 'ru' ? ['yookassa', 'stars'] : ['paddle', 'stars']
  }
  const enabledSet = new Set(enabled)
  const result = ordered.filter((m) => enabledSet.has(m))
  // mock — только как явный фиче-флаг (dev/тесты), всегда последним
  if (enabledSet.has('mock')) result.push('mock')
  return result
}

// ======================================
// Промокоды
// ======================================

export function normalizePromoCode(raw) {
  return String(raw || '').trim().toUpperCase()
}

// Валидация кода (кроме «уже активирован этим юзером» — это unique-констрейнт в БД).
// Возвращает { ok: true } | { ok: false, code, message }
export function validatePromoCode(promo, { now = new Date(), redemptionsCount = 0, planCode = null } = {}) {
  const fail = (code, message) => ({ ok: false, code, message })

  if (!promo || !promo.isActive) return fail('PROMO_NOT_FOUND', 'Промокод не найден или отключён')
  if (promo.expiresAt && promo.expiresAt <= now) return fail('PROMO_EXPIRED', 'Срок действия промокода истёк')
  if (promo.maxRedemptions != null && redemptionsCount >= promo.maxRedemptions) {
    return fail('PROMO_LIMIT_REACHED', 'Лимит активаций промокода исчерпан')
  }
  // planCode передаётся только в момент checkout'а (для discount-кодов)
  if (planCode && promo.planCode && promo.planCode !== planCode) {
    return fail('PROMO_WRONG_PLAN', 'Промокод действует на другой план')
  }
  if (promo.kind === 'free_period') {
    if (!Number.isInteger(promo.freeDays) || promo.freeDays <= 0) {
      return fail('PROMO_MISCONFIGURED', 'Промокод настроен некорректно')
    }
  } else if (promo.kind === 'discount') {
    if (!Number.isInteger(promo.discountPct) || promo.discountPct < 1 || promo.discountPct > 99) {
      return fail('PROMO_MISCONFIGURED', 'Промокод настроен некорректно')
    }
  } else {
    return fail('PROMO_MISCONFIGURED', 'Промокод настроен некорректно')
  }
  return { ok: true }
}

// Скидка: округление вниз недопустимо ронять цену в 0 — минимальная единица валюты
export function applyDiscount(amount, discountPct) {
  const discounted = Math.round((amount * (100 - discountPct)) / 100)
  return Math.max(1, discounted)
}

// ======================================
// Рекуррентка (ЮKassa, фаза 3): решение по подписке в кроне
// ======================================
//
// Политика (§6.3): списываем за 24ч до конца периода; неудача → past_due и
// ретраи не чаще раза в 24ч; после MAX_RENEWAL_ATTEMPTS неудач подряд — expired.
// Крон ходит раз в час, функция идемпотентна по времени: повторный вызов
// в тот же час не порождает второе списание.

export const RENEWAL_WINDOW_HOURS = 24 // начинаем продлевать за сутки до конца
export const RENEWAL_RETRY_HOURS = 24 // пауза между попытками
export const MAX_RENEWAL_ATTEMPTS = 3 // после трёх неудач подряд — expired

// sub → 'skip' | 'charge' | 'expire'
export function planRenewalAction(sub, { now = new Date(), graceHours = 24 } = {}) {
  if (!sub || !sub.autoRenew || !sub.paymentMethodId) return 'skip'
  if (sub.currentPeriodEnd == null) return 'skip' // lifetime не продлевается
  if (sub.status !== 'active' && sub.status !== 'past_due') return 'skip'

  const hourMs = 60 * 60 * 1000
  const windowStart = sub.currentPeriodEnd.getTime() - RENEWAL_WINDOW_HOURS * hourMs
  if (now.getTime() < windowStart) return 'skip' // до окна продления далеко

  // Исчерпали попытки — доступ закрывается (grace на этом кончается)
  if (sub.renewalAttempts >= MAX_RENEWAL_ATTEMPTS) return 'expire'

  // Период + grace истекли, а списать так и не удалось — тоже expired,
  // даже если попыток меньше трёх (например, крон долго не работал)
  if (now.getTime() > sub.currentPeriodEnd.getTime() + graceHours * hourMs) return 'expire'

  // Не долбим карту чаще раза в сутки
  if (sub.lastRenewalAttemptAt &&
      now.getTime() - sub.lastRenewalAttemptAt.getTime() < RENEWAL_RETRY_HOURS * hourMs) {
    return 'skip'
  }
  return 'charge'
}
