// ======================================
// Mock-провайдер — dev/тесты (включается PAYMENT_PROVIDERS=mock)
// ======================================
//
// Имитирует мгновенно успешную оплату: checkout сразу применяет платёж
// через billingService (type: 'granted'), фронт просто рефетчит статус.
// Позволяет прогнать весь paywall-флоу без единого реального провайдера.

import { randomUUID } from 'node:crypto'
import { applySuccessfulPayment } from '../billingService.js'

export function createMockProvider() {
  return {
    name: 'mock',
    async createCheckout({ user, plan, amount, currency, redemptionId }) {
      await applySuccessfulPayment({
        userId: user.id,
        planCode: plan.code,
        provider: 'mock',
        providerPaymentId: `mock_${randomUUID()}`,
        amount,
        currency,
        redemptionId,
      })
      return { type: 'granted' }
    },
  }
}
