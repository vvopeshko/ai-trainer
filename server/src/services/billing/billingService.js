// ======================================
// billingService — ЯДРО entitlement-слоя (product/ARCHITECTURE_PAYMENTS.md §5.1)
// ======================================
//
// Единственное место, где создаются/продлеваются подписки. Все источники —
// платёжные провайдеры, промокод, admin/grant — сходятся сюда.
// Идемпотентность: Payment.providerPaymentId @unique (P2002 → no-op).
//
// Чистая логика (периоды, активность, валидации) — в billingCore.js (покрыта тестами);
// здесь — только склейка с prisma.

import prisma from '../../utils/prisma.js'
import { track } from '../../utils/analytics.js'
import { AppError } from '../../middleware/errorHandler.js'
import {
  PERIOD_DAYS, LOCAL_PROVIDERS,
  computeNewPeriodEnd, isSubscriptionActive, isLifetime,
  normalizePromoCode, validatePromoCode, applyDiscount,
} from './billingCore.js'
import { getPlan, getPrice } from './pricing.js'

const graceHours = () => Number(process.env.BILLING_GRACE_HOURS || 24)

// У юзера одна строка Subscription (single-row, держится логикой этого файла)
function findSubscription(userId, tx = prisma) {
  return tx.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  })
}

// Общий грант периода: платёж, промокод, admin — одна механика продления.
// periodEnd — override для «толстых» провайдеров (Tribute/Paddle/IAP): их expires_at
// авторитетнее нашей арифметики. lifetime (plan.period === 'lifetime') обнуляет
// currentPeriodEnd; активный lifetime поглощает любой последующий грант периода.
async function grantPeriod(tx, { userId, plan, provider, days, autoRenew = false, periodEnd = null, extra = {} }) {
  const sub = await findSubscription(userId, tx)

  // Активный lifetime поглощает любой периодный грант: подписку не трогаем
  // (платёж всё равно фиксируется вызывающей стороной — след для рефанда)
  if (isLifetime(sub) && plan.period !== 'lifetime') return sub

  const isLifetimePlan = plan.period === 'lifetime'
  const currentPeriodEnd = isLifetimePlan
    ? null
    : periodEnd ?? computeNewPeriodEnd({ currentPeriodEnd: sub?.currentPeriodEnd, days })

  const data = {
    planId: plan.id,
    provider,
    status: 'active',
    currentPeriodEnd,
    autoRenew: isLifetimePlan ? false : autoRenew,
    canceledAt: null,
    // Успешный грант сбрасывает счётчик неудачных списаний (выход из past_due)
    renewalAttempts: 0,
    ...extra,
  }
  if (sub) {
    return tx.subscription.update({ where: { id: sub.id }, data, include: { plan: true } })
  }
  return tx.subscription.create({ data: { userId, ...data }, include: { plan: true } })
}

// ======================================
// Статус (единственная точка проверки Premium)
// ======================================

export async function getBillingStatus(userId) {
  const sub = await findSubscription(userId)
  const active = isSubscriptionActive(sub, { graceHours: graceHours() })
  return {
    active,
    plan: active ? sub.plan.code : null,
    period: active ? sub.plan.period : null,
    periodEnd: sub?.currentPeriodEnd ?? null, // null при active = lifetime
    autoRenew: active ? sub.autoRenew : false,
    provider: active ? sub.provider : null,
    // Единый рубильник hard paywall — фронт гейтит по нему же (env только на Railway)
    gatingEnabled: process.env.PREMIUM_GATING === 'on',
  }
}

export async function isPremium(userId) {
  const sub = await findSubscription(userId)
  return isSubscriptionActive(sub, { graceHours: graceHours() })
}

// ======================================
// Применение успешного платежа (идемпотентно)
// ======================================
//
// Возвращает { status, duplicate }. redemptionId — pending-активация discount-промокода,
// которую этот платёж «закрывает».

export async function applySuccessfulPayment({
  userId, planCode, provider, providerPaymentId, amount, currency, meta = null, redemptionId = null,
  // Рекуррентные провайдеры: autoRenew=true + сохранённый метод/согласие (ЮKassa, §6.3)
  autoRenew = false, subscriptionExtra = {},
  // «Толстые» провайдеры: конец периода из их события (Tribute expires_at, §6.2)
  periodEndOverride = null,
}) {
  const plan = await getPlan(planCode)
  const days = PERIOD_DAYS[plan.period] ?? null // lifetime — без дней

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { userId, planId: plan.id, provider, providerPaymentId, status: 'succeeded', amount, currency, meta },
      })
      await grantPeriod(tx, {
        userId, plan, provider, days, autoRenew,
        periodEnd: periodEndOverride, extra: subscriptionExtra,
      })
      if (redemptionId) {
        await tx.promoRedemption.update({
          where: { id: redemptionId },
          data: { status: 'applied', appliedAt: new Date(), paymentId: payment.id },
        })
      }
    })
  } catch (err) {
    // P2002 по providerPaymentId — повторный вебхук/апдейт, уже применено
    if (err?.code === 'P2002') {
      console.log(`[billing] duplicate payment ${provider}/${providerPaymentId} — skip`)
      return { status: await getBillingStatus(userId), duplicate: true }
    }
    throw err
  }

  console.log(`[billing] payment applied: user=${userId} plan=${planCode} provider=${provider}`)
  track(userId, 'payment_succeeded', { planCode, provider, amount, currency })
  return { status: await getBillingStatus(userId), duplicate: false }
}

// ======================================
// Промокоды (бесплатных источников кроме promo/admin нет — триал не даём)
// ======================================

export async function redeemPromo(userId, rawCode) {
  const code = normalizePromoCode(rawCode)
  if (!code) throw new AppError(400, 'PROMO_NOT_FOUND', 'Введите промокод')

  const promo = await prisma.promoCode.findUnique({
    where: { code },
    include: { _count: { select: { redemptions: true } } },
  })
  const check = validatePromoCode(promo, { redemptionsCount: promo?._count?.redemptions ?? 0 })
  if (!check.ok) throw new AppError(promo ? 400 : 404, check.code, check.message)

  try {
    if (promo.kind === 'free_period') {
      const plan = await getPlan(promo.planCode || 'premium_week')
      await prisma.$transaction(async (tx) => {
        await tx.promoRedemption.create({
          data: { promoCodeId: promo.id, userId, status: 'applied', appliedAt: new Date() },
        })
        await grantPeriod(tx, { userId, plan, provider: 'promo', days: promo.freeDays })
      })
      console.log(`[billing] promo free_period applied: user=${userId} code=${code}`)
      track(userId, 'promo_redeemed', { code, kind: 'free_period', freeDays: promo.freeDays })
      return { kind: 'free_period', freeDays: promo.freeDays, status: await getBillingStatus(userId) }
    }

    // discount: активация висит pending, применится в checkout
    await prisma.promoRedemption.create({
      data: { promoCodeId: promo.id, userId, status: 'pending' },
    })
    console.log(`[billing] promo discount pending: user=${userId} code=${code}`)
    track(userId, 'promo_redeemed', { code, kind: 'discount', discountPct: promo.discountPct })
    return { kind: 'discount', discountPct: promo.discountPct, planCode: promo.planCode }
  } catch (err) {
    // unique(promoCodeId, userId) — код уже активирован этим юзером
    if (err?.code === 'P2002') {
      throw new AppError(409, 'PROMO_ALREADY_USED', 'Этот промокод уже активирован')
    }
    throw err
  }
}

// ======================================
// Сумма к оплате (checkout): цена по региону минус pending-скидка (§5.2)
// ======================================

export async function resolveCheckoutAmount({ userId, planCode, provider, region }) {
  const price = await getPrice(planCode, provider, region)
  let amount = price.amount
  let redemptionId = null

  // Paddle: сумму диктует их price_id — нашу скидку в сумму не вшить.
  // Промокод НЕ применяем (redemption остаётся pending для других методов);
  // TODO(операционка фазы 5): маппинг на Paddle Discounts (discount_id в transaction)
  if (provider === 'paddle') {
    return { amount, currency: price.currency, providerPriceId: price.providerPriceId, redemptionId: null }
  }

  const pending = await prisma.promoRedemption.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: { promoCode: true },
  })
  if (pending) {
    const check = validatePromoCode(pending.promoCode, {
      // лимит уже учтён при активации; здесь проверяем срок и план
      redemptionsCount: 0,
      planCode,
    })
    if (check.ok && pending.promoCode.kind === 'discount') {
      amount = applyDiscount(amount, pending.promoCode.discountPct)
      redemptionId = pending.id
    }
  }

  return { amount, currency: price.currency, providerPriceId: price.providerPriceId, redemptionId }
}

// ======================================
// Отмена автопродления и возвраты
// ======================================

export async function cancelAutoRenew(userId) {
  const sub = await findSubscription(userId)
  if (!sub || !isSubscriptionActive(sub, { graceHours: graceHours() })) {
    throw new AppError(409, 'NO_ACTIVE_SUBSCRIPTION', 'Нет активной подписки')
  }
  if (!sub.autoRenew) return getBillingStatus(userId) // идемпотентно: уже без автопродления

  // Tribute/Paddle/IAP: жизненный цикл у провайдера — отмена в их интерфейсе/API.
  // Paddle-ветка (их API cancel) появится в фазе 5; до неё все нелокальные — 501.
  if (!LOCAL_PROVIDERS.has(sub.provider)) {
    throw new AppError(501, 'CANCEL_VIA_PROVIDER', `Отмена для ${sub.provider} — на стороне провайдера`)
  }
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { autoRenew: false, status: sub.status === 'active' ? 'canceled' : sub.status, canceledAt: new Date() },
  })
  console.log(`[billing] auto-renew canceled: user=${userId}`)
  track(userId, 'subscription_canceled', { provider: sub.provider })
  return getBillingStatus(userId)
}

// Отмена, пришедшая ОТ провайдера (вебхук cancelledSubscription Tribute/Paddle):
// автопродление гаснет, оплаченный период дохаживается. Без AppError — вебхук
// не должен падать из-за рассинхрона (подписки может уже не быть).
export async function cancelFromProvider(userId, provider) {
  const sub = await findSubscription(userId)
  if (!sub || sub.provider !== provider) {
    console.warn(`[billing] cancelFromProvider: no ${provider} subscription for user=${userId}`)
    return null
  }
  if (!sub.autoRenew && sub.status !== 'active') return getBillingStatus(userId) // уже отменена
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      autoRenew: false,
      status: sub.status === 'active' ? 'canceled' : sub.status,
      canceledAt: new Date(),
    },
  })
  console.log(`[billing] provider cancel applied: user=${userId} provider=${provider}`)
  track(userId, 'subscription_canceled', { provider, source: 'provider_webhook' })
  return getBillingStatus(userId)
}

export async function revokeForRefund(providerPaymentId) {
  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId },
    include: { plan: true },
  })
  if (!payment || payment.status === 'refunded') return null

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } })
    const sub = await findSubscription(payment.userId, tx)
    if (!sub) return
    if (payment.plan.period === 'lifetime') {
      // lifetime без даты конца — рефанд закрывает доступ сразу
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired', currentPeriodEnd: new Date(), autoRenew: false },
      })
      return
    }
    if (sub.currentPeriodEnd == null) return // активный lifetime рефандом недели не трогаем
    const days = PERIOD_DAYS[payment.plan.period]
    const cut = new Date(sub.currentPeriodEnd.getTime() - days * 24 * 60 * 60 * 1000)
    await tx.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: cut, status: cut <= new Date() ? 'expired' : sub.status },
    })
  })
  console.log(`[billing] refund applied: payment=${providerPaymentId}`)
  track(payment.userId, 'payment_refunded', { provider: payment.provider, planCode: payment.plan.code })
  return getBillingStatus(payment.userId)
}

// ======================================
// Рекуррентка (крон subscriptionRenewal, фаза 3)
// ======================================

// Кандидаты на продление: окно = сутки до конца периода + grace-хвост для ретраев
export function findRenewalCandidates({ now = new Date() } = {}) {
  const hourMs = 60 * 60 * 1000
  return prisma.subscription.findMany({
    where: {
      autoRenew: true,
      provider: 'yookassa',
      status: { in: ['active', 'past_due'] },
      paymentMethodId: { not: null },
      currentPeriodEnd: { lt: new Date(now.getTime() + 24 * hourMs) },
      // нижняя граница — чтобы не перебирать давно умершие подписки
      updatedAt: { gt: new Date(now.getTime() - 14 * 24 * hourMs) },
    },
    include: { plan: true, user: true },
  })
}

// Неудачная попытка списания: attempts++ и past_due (доступ остаётся до expire)
export async function markRenewalFailure(subId) {
  return prisma.subscription.update({
    where: { id: subId },
    data: {
      status: 'past_due',
      renewalAttempts: { increment: 1 },
      lastRenewalAttemptAt: new Date(),
    },
    include: { user: true },
  })
}

// Попытка ушла в ЮKassa (pending) — фиксируем время, результат доедет вебхуком
export function markRenewalAttempt(subId) {
  return prisma.subscription.update({
    where: { id: subId },
    data: { lastRenewalAttemptAt: new Date() },
  })
}

export async function expireSubscription(subId) {
  const sub = await prisma.subscription.update({
    where: { id: subId },
    data: { status: 'expired', autoRenew: false },
    include: { user: true },
  })
  console.log(`[billing] subscription expired: user=${sub.userId}`)
  track(sub.userId, 'subscription_expired', { provider: sub.provider })
  return sub
}

// ======================================
// Ручная выдача (саппорт, подарки, grandfathering) — admin/billing/grant
// ======================================

export async function grantManual({ userId, days, planCode = 'premium_week' }) {
  const plan = await getPlan(planCode)
  await prisma.$transaction(async (tx) => {
    await grantPeriod(tx, { userId, plan, provider: 'admin', days })
  })
  console.log(`[billing] manual grant: user=${userId} days=${days}`)
  track(userId, 'premium_granted', { days, planCode })
  return getBillingStatus(userId)
}
