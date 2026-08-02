import { describe, test, expect } from 'vitest'
import {
  computeNewPeriodEnd, isSubscriptionActive, isLifetime, resolvePriceRegion,
  pickPrice, availableMethods, normalizePromoCode, validatePromoCode, applyDiscount,
  planRenewalAction, PERIOD_DAYS, MAX_RENEWAL_ATTEMPTS,
} from './billingCore.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-07-12T12:00:00Z')
const days = (n) => new Date(NOW.getTime() + n * DAY_MS)

describe('computeNewPeriodEnd — периоды складываются, не сгорают', () => {
  test('без подписки: now + период', () => {
    const end = computeNewPeriodEnd({ currentPeriodEnd: null, days: 7, now: NOW })
    expect(end.getTime()).toBe(days(7).getTime())
  })

  test('активная подписка: продление от её конца (купил месяц при живой неделе — неделя не сгорела)', () => {
    const end = computeNewPeriodEnd({ currentPeriodEnd: days(3), days: PERIOD_DAYS.month, now: NOW })
    expect(end.getTime()).toBe(days(3 + 30).getTime())
  })

  test('истёкшая подписка: продление от now, а не от прошлого', () => {
    const end = computeNewPeriodEnd({ currentPeriodEnd: days(-10), days: 7, now: NOW })
    expect(end.getTime()).toBe(days(7).getTime())
  })
})

describe('isSubscriptionActive — статус + grace + lifetime', () => {
  const sub = (status, periodEndDays) => ({ status, currentPeriodEnd: days(periodEndDays) })

  test('active с будущим концом — активна', () => {
    expect(isSubscriptionActive(sub('active', 5), { now: NOW })).toBe(true)
  })

  test('canceled дохаживает оплаченный период', () => {
    expect(isSubscriptionActive(sub('canceled', 2), { now: NOW })).toBe(true)
  })

  test('past_due активна в grace (идут ретраи)', () => {
    expect(isSubscriptionActive(sub('past_due', 0.5), { now: NOW })).toBe(true)
  })

  test('grace: конец периода в прошлом внутри 24ч — ещё активна, за пределами — нет', () => {
    const halfDayAgo = { status: 'active', currentPeriodEnd: new Date(NOW.getTime() - 12 * 60 * 60 * 1000) }
    expect(isSubscriptionActive(halfDayAgo, { now: NOW, graceHours: 24 })).toBe(true)
    expect(isSubscriptionActive(halfDayAgo, { now: NOW, graceHours: 6 })).toBe(false)
  })

  test('lifetime (currentPeriodEnd = null) активна всегда, пока статус живой', () => {
    expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: null }, { now: NOW })).toBe(true)
    expect(isSubscriptionActive({ status: 'expired', currentPeriodEnd: null }, { now: NOW })).toBe(false)
    expect(isLifetime({ status: 'active', currentPeriodEnd: null })).toBe(true)
    expect(isLifetime(sub('active', 5))).toBe(false)
    expect(isLifetime(null)).toBe(false)
  })

  test('expired и отсутствие подписки — не активна', () => {
    expect(isSubscriptionActive(sub('expired', 5), { now: NOW })).toBe(false)
    expect(isSubscriptionActive(null, { now: NOW })).toBe(false)
  })
})

describe('resolvePriceRegion — страна побеждает язык', () => {
  test('geoip RU → ru, независимо от языка', () => {
    expect(resolvePriceRegion({ countryCode: 'RU', languageCode: 'en' })).toBe('ru')
  })
  test('geoip не-RU → default, даже с русским языком (VPN/эмиграция)', () => {
    expect(resolvePriceRegion({ countryCode: 'DE', languageCode: 'ru' })).toBe('default')
  })
  test('без страны: язык ru/ru-RU → ru', () => {
    expect(resolvePriceRegion({ languageCode: 'ru' })).toBe('ru')
    expect(resolvePriceRegion({ languageCode: 'ru-RU' })).toBe('ru')
  })
  test('без сигналов → default', () => {
    expect(resolvePriceRegion({})).toBe('default')
    expect(resolvePriceRegion({ languageCode: 'en' })).toBe('default')
  })
})

describe('pickPrice — fallback региона на default', () => {
  const prices = [
    { provider: 'stars', region: 'ru', amount: 800 },
    { provider: 'stars', region: 'default', amount: 800 },
    { provider: 'yookassa', region: 'ru', amount: 99000 },
  ]

  test('точный регион', () => {
    expect(pickPrice(prices, 'yookassa', 'ru').amount).toBe(99000)
  })
  test('нет корзины → default', () => {
    expect(pickPrice(prices, 'stars', 'latam').amount).toBe(800)
  })
  test('нет даже default → null (метод недоступен, напр. lifetime у tribute)', () => {
    expect(pickPrice(prices, 'yookassa', 'default')).toBe(null)
    expect(pickPrice(prices, 'tribute', 'ru')).toBe(null)
  })
})

describe('availableMethods — матрица §3', () => {
  const ALL = ['stars', 'yookassa', 'tribute', 'paddle']

  test('TMA iOS: только Stars (правило Apple)', () => {
    expect(availableMethods({ platform: 'telegram', tmaClient: 'ios', region: 'ru', enabled: ALL }))
      .toEqual(['stars'])
  })
  test('TMA Android, RU: Tribute первым, Stars альтернативой', () => {
    expect(availableMethods({ platform: 'telegram', tmaClient: 'android', region: 'ru', enabled: ALL }))
      .toEqual(['tribute', 'stars'])
  })
  test('TMA не-RU: Stars, потом Paddle', () => {
    expect(availableMethods({ platform: 'telegram', tmaClient: 'tdesktop', region: 'default', enabled: ALL }))
      .toEqual(['stars', 'paddle'])
  })
  test('web RU: ЮKassa первой', () => {
    expect(availableMethods({ platform: 'web', region: 'ru', enabled: ALL }))
      .toEqual(['yookassa', 'stars'])
  })
  test('web не-RU: Paddle первым', () => {
    expect(availableMethods({ platform: 'web', region: 'default', enabled: ALL }))
      .toEqual(['paddle', 'stars'])
  })
  test('фиче-флаги режут список (включены только stars)', () => {
    expect(availableMethods({ platform: 'telegram', tmaClient: 'android', region: 'ru', enabled: ['stars'] }))
      .toEqual(['stars'])
  })
  test('mock добавляется последним только при явном флаге', () => {
    expect(availableMethods({ platform: 'web', region: 'ru', enabled: ['mock'] }))
      .toEqual(['mock'])
  })
})

describe('промокоды', () => {
  const base = { isActive: true, expiresAt: null, maxRedemptions: null, planCode: null }
  const freePromo = { ...base, kind: 'free_period', freeDays: 14 }
  const discPromo = { ...base, kind: 'discount', discountPct: 50 }

  test('нормализация кода', () => {
    expect(normalizePromoCode('  friends2026 ')).toBe('FRIENDS2026')
    expect(normalizePromoCode(null)).toBe('')
  })

  test('валидные коды проходят', () => {
    expect(validatePromoCode(freePromo, { now: NOW }).ok).toBe(true)
    expect(validatePromoCode(discPromo, { now: NOW }).ok).toBe(true)
  })

  test('null / отключённый → PROMO_NOT_FOUND', () => {
    expect(validatePromoCode(null, { now: NOW }).code).toBe('PROMO_NOT_FOUND')
    expect(validatePromoCode({ ...freePromo, isActive: false }, { now: NOW }).code).toBe('PROMO_NOT_FOUND')
  })

  test('истёкший → PROMO_EXPIRED', () => {
    const expired = { ...freePromo, expiresAt: days(-1) }
    expect(validatePromoCode(expired, { now: NOW }).code).toBe('PROMO_EXPIRED')
  })

  test('лимит активаций → PROMO_LIMIT_REACHED', () => {
    const limited = { ...freePromo, maxRedemptions: 10 }
    expect(validatePromoCode(limited, { now: NOW, redemptionsCount: 10 }).code).toBe('PROMO_LIMIT_REACHED')
    expect(validatePromoCode(limited, { now: NOW, redemptionsCount: 9 }).ok).toBe(true)
  })

  test('привязка к плану проверяется только при переданном planCode (checkout)', () => {
    const monthOnly = { ...discPromo, planCode: 'premium_month' }
    expect(validatePromoCode(monthOnly, { now: NOW }).ok).toBe(true)
    expect(validatePromoCode(monthOnly, { now: NOW, planCode: 'premium_week' }).code).toBe('PROMO_WRONG_PLAN')
    expect(validatePromoCode(monthOnly, { now: NOW, planCode: 'premium_month' }).ok).toBe(true)
  })

  test('кривые настройки → PROMO_MISCONFIGURED', () => {
    expect(validatePromoCode({ ...base, kind: 'free_period', freeDays: 0 }, { now: NOW }).code).toBe('PROMO_MISCONFIGURED')
    expect(validatePromoCode({ ...base, kind: 'discount', discountPct: 100 }, { now: NOW }).code).toBe('PROMO_MISCONFIGURED')
    expect(validatePromoCode({ ...base, kind: 'cashback' }, { now: NOW }).code).toBe('PROMO_MISCONFIGURED')
  })

  test('applyDiscount: округление и минимум в 1 единицу', () => {
    expect(applyDiscount(99000, 50)).toBe(49500)
    expect(applyDiscount(299, 90)).toBe(30)
    expect(applyDiscount(1, 99)).toBe(1) // не роняем в 0
  })
})

describe('planRenewalAction — машина состояний рекуррентки (фаза 3)', () => {
  const hours = (n) => new Date(NOW.getTime() + n * 60 * 60 * 1000)
  const base = {
    autoRenew: true,
    provider: 'yookassa',
    status: 'active',
    paymentMethodId: 'pm_1',
    renewalAttempts: 0,
    lastRenewalAttemptAt: null,
  }

  test('до окна продления (конец периода дальше 24ч) — skip', () => {
    expect(planRenewalAction({ ...base, currentPeriodEnd: hours(30) }, { now: NOW })).toBe('skip')
  })

  test('внутри окна — charge', () => {
    expect(planRenewalAction({ ...base, currentPeriodEnd: hours(12) }, { now: NOW })).toBe('charge')
  })

  test('lifetime не продлевается', () => {
    expect(planRenewalAction({ ...base, currentPeriodEnd: null }, { now: NOW })).toBe('skip')
  })

  test('без autoRenew / без сохранённого метода / canceled — skip', () => {
    expect(planRenewalAction({ ...base, currentPeriodEnd: hours(12), autoRenew: false }, { now: NOW })).toBe('skip')
    expect(planRenewalAction({ ...base, currentPeriodEnd: hours(12), paymentMethodId: null }, { now: NOW })).toBe('skip')
    expect(planRenewalAction({ ...base, currentPeriodEnd: hours(12), status: 'canceled' }, { now: NOW })).toBe('skip')
  })

  test('недавняя попытка (<24ч) — skip, старая — charge', () => {
    const sub = { ...base, status: 'past_due', currentPeriodEnd: hours(2), renewalAttempts: 1 }
    expect(planRenewalAction({ ...sub, lastRenewalAttemptAt: hours(-3) }, { now: NOW })).toBe('skip')
    expect(planRenewalAction({ ...sub, lastRenewalAttemptAt: hours(-25) }, { now: NOW })).toBe('charge')
  })

  test('исчерпаны попытки — expire', () => {
    const sub = { ...base, status: 'past_due', currentPeriodEnd: hours(-2), renewalAttempts: MAX_RENEWAL_ATTEMPTS }
    expect(planRenewalAction(sub, { now: NOW })).toBe('expire')
  })

  test('период + grace позади, а списать не удалось — expire даже при неисчерпанных попытках', () => {
    const sub = { ...base, status: 'past_due', currentPeriodEnd: hours(-30), renewalAttempts: 1, lastRenewalAttemptAt: hours(-26) }
    expect(planRenewalAction(sub, { now: NOW, graceHours: 24 })).toBe('expire')
  })

  test('повторный тик крона в тот же час не даёт второе списание (идемпотентность по времени)', () => {
    const sub = { ...base, currentPeriodEnd: hours(12), lastRenewalAttemptAt: NOW }
    expect(planRenewalAction(sub, { now: NOW })).toBe('skip')
  })
})
