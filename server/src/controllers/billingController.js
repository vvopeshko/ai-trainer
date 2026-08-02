// ======================================
// Billing Controller — /api/v1/billing/* (product/ARCHITECTURE_PAYMENTS.md §5.3)
// ======================================
//
// Тонкий слой над billingService/pricing: валидация входа (zod) + формат ответа.
// Цены НИКОГДА не приходят от клиента — только planCode + method (§7.4).

import { z } from 'zod'
import { AppError } from '../middleware/errorHandler.js'
import {
  getBillingStatus, redeemPromo, cancelAutoRenew,
  resolveCheckoutAmount, grantManual,
} from '../services/billing/billingService.js'
import { listPlans, resolvePriceRegion, resolveMethods, getPlan } from '../services/billing/pricing.js'
import { createPaymentProvider } from '../services/billing/provider/index.js'
import { track } from '../utils/analytics.js'
import prisma from '../utils/prisma.js'

// GET /api/v1/billing/status
export async function getStatus(req, res, next) {
  try {
    const billing = await getBillingStatus(req.user.id)
    res.json({ billing })
  } catch (err) {
    next(err)
  }
}

// GET /api/v1/billing/plans — планы + цены для региона юзера + доступные методы
export async function getPlans(req, res, next) {
  try {
    const region = resolvePriceRegion(req)
    const methods = resolveMethods(req, region)
    const plans = await listPlans()
    // Paywall грузит планы ровно при показе — серверный прокси события paywall_shown
    track(req.user.id, 'paywall_shown', { region, methods })

    res.json({
      region,
      methods,
      plans: plans.map((plan) => ({
        code: plan.code,
        period: plan.period,
        // цены только по доступным методам; region-fallback как в getPrice.
        // Метод без цены на план не попадает в prices (lifetime у tribute) —
        // фронт скрывает недоступную комбинацию.
        prices: methods
          .map((method) => {
            const price =
              plan.prices.find((p) => p.provider === method && p.region === region) ||
              plan.prices.find((p) => p.provider === method && p.region === 'default')
            return price && { method, amount: price.amount, currency: price.currency }
          })
          .filter(Boolean),
      })),
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/v1/billing/checkout { planCode, method }
const checkoutSchema = z.object({
  planCode: z.string().min(1),
  method: z.string().min(1),
})

export async function checkout(req, res, next) {
  try {
    const { planCode, method } = checkoutSchema.parse(req.body)
    const region = resolvePriceRegion(req)

    if (!resolveMethods(req, region).includes(method)) {
      throw new AppError(400, 'METHOD_UNAVAILABLE', `Способ оплаты «${method}» недоступен`)
    }

    const plan = await getPlan(planCode)
    const { amount, currency, providerPriceId, redemptionId } = await resolveCheckoutAmount({
      userId: req.user.id, planCode, provider: method, region,
    })

    track(req.user.id, 'checkout_started', { planCode, method, region, amount })
    const provider = createPaymentProvider(method)
    const result = await provider.createCheckout({
      user: req.user, plan, amount, currency, providerPriceId, redemptionId,
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// POST /api/v1/billing/promo/redeem { code }
const promoSchema = z.object({ code: z.string().min(1).max(64) })

export async function postRedeemPromo(req, res, next) {
  try {
    const { code } = promoSchema.parse(req.body)
    const result = await redeemPromo(req.user.id, code)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// POST /api/v1/billing/cancel
export async function postCancel(req, res, next) {
  try {
    const billing = await cancelAutoRenew(req.user.id)
    res.json({ billing })
  } catch (err) {
    next(err)
  }
}

// POST /api/v1/admin/billing/grant?key=ANALYTICS_SECRET { userId? telegramId?, days, planCode? }
// Секрет проверяет гейт routes/admin.js. Для саппорта, подарков, grandfathering.
const grantSchema = z.object({
  userId: z.string().uuid().optional(),
  telegramId: z.coerce.bigint().optional(),
  days: z.number().int().min(1).max(3650),
  planCode: z.string().optional(),
})

export async function postAdminGrant(req, res, next) {
  try {
    const { userId, telegramId, days, planCode } = grantSchema.parse(req.body)

    let targetId = userId
    if (!targetId && telegramId != null) {
      const user = await prisma.user.findUnique({ where: { telegramId } })
      if (!user) throw new AppError(404, 'NOT_FOUND', 'Пользователь не найден')
      targetId = user.id
    }
    if (!targetId) throw new AppError(400, 'VALIDATION_ERROR', 'Нужен userId или telegramId')

    const billing = await grantManual({ userId: targetId, days, planCode })
    res.json({ billing })
  } catch (err) {
    next(err)
  }
}
