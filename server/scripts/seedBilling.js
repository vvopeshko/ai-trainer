/**
 * Сид биллинга: планы + цены по регион-корзинам (product/ARCHITECTURE_PAYMENTS.md §4).
 *
 * Idempotent: upsert по уникальным ключам. Каталог кешируется в памяти сервера
 * (services/billing/pricing.js) — после изменения цен на живом сервере нужен рестарт.
 *
 * Цены ru — с лендинга (990 / 3000 / 15000 ₽). Цены default-корзины — черновик
 * (открытый вопрос §10.3), Stars по курсу ~$0.013/⭐.
 *
 * Запуск: cd server && node scripts/seedBilling.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PLANS = [
  {
    code: 'premium_week',
    period: 'week',
    sortOrder: 1,
    prices: [
      // provider, region, currency, amount (минимальные единицы: копейки / ⭐ / центы)
      { provider: 'yookassa', region: 'ru', currency: 'RUB', amount: 99000 }, // 990 ₽
      { provider: 'tribute', region: 'ru', currency: 'RUB', amount: 99000 },
      { provider: 'stars', region: 'ru', currency: 'XTR', amount: 800 }, // ≈990 ₽
      { provider: 'stars', region: 'default', currency: 'XTR', amount: 800 }, // ≈$9.99
      { provider: 'paddle', region: 'default', currency: 'USD', amount: 999 }, // $9.99 (price_id — фаза 5)
      { provider: 'mock', region: 'default', currency: 'USD', amount: 999 }, // dev/тесты
    ],
  },
  {
    code: 'premium_month',
    period: 'month',
    sortOrder: 2,
    prices: [
      { provider: 'yookassa', region: 'ru', currency: 'RUB', amount: 300000 }, // 3000 ₽
      { provider: 'tribute', region: 'ru', currency: 'RUB', amount: 300000 },
      { provider: 'stars', region: 'ru', currency: 'XTR', amount: 2400 }, // ≈3000 ₽
      { provider: 'stars', region: 'default', currency: 'XTR', amount: 2300 }, // ≈$29.99
      { provider: 'paddle', region: 'default', currency: 'USD', amount: 2999 }, // $29.99
      { provider: 'mock', region: 'default', currency: 'USD', amount: 2999 },
    ],
  },
  {
    code: 'premium_lifetime',
    period: 'lifetime',
    sortOrder: 3,
    prices: [
      { provider: 'yookassa', region: 'ru', currency: 'RUB', amount: 1500000 }, // 15000 ₽
      // Tribute — только подписки, lifetime через него не продаём (§6.2)
      { provider: 'stars', region: 'ru', currency: 'XTR', amount: 12000 }, // ≈15000 ₽ (⚠️ проверить лимит инвойса, §10.2)
      { provider: 'stars', region: 'default', currency: 'XTR', amount: 11500 }, // ≈$149
      { provider: 'paddle', region: 'default', currency: 'USD', amount: 14900 }, // $149 one-time
      { provider: 'mock', region: 'default', currency: 'USD', amount: 14900 },
    ],
  },
]

async function main() {
  for (const { prices, ...plan } of PLANS) {
    const row = await prisma.billingPlan.upsert({
      where: { code: plan.code },
      update: { period: plan.period, sortOrder: plan.sortOrder, isActive: true },
      create: plan,
    })
    for (const price of prices) {
      await prisma.billingPlanPrice.upsert({
        where: {
          planId_provider_region_currency: {
            planId: row.id,
            provider: price.provider,
            region: price.region,
            currency: price.currency,
          },
        },
        update: { amount: price.amount },
        create: { planId: row.id, ...price },
      })
    }
    console.log(`✓ ${plan.code}: ${prices.length} цен`)
  }

  // Промокоды создаются точечно этим же паттерном (не сидируются массово):
  // await prisma.promoCode.create({ data: {
  //   code: 'FRIENDS30', kind: 'free_period', freeDays: 30,
  //   maxRedemptions: 20, comment: 'близкие друзья',
  // }})
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
