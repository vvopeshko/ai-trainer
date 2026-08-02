// ======================================
// Фабрика платёжных провайдеров (паттерн services/aiTrainer + utils/llm.js)
// ======================================
//
// Интерфейс провайдера:
//   name: string
//   createCheckout({ user, plan, amount, currency, providerPriceId, redemptionId })
//     → { type: 'invoice_link' | 'telegram_link' | 'redirect' | 'granted', url? }
//
// Реальные адаптеры подключаются по фазам (product/ARCHITECTURE_PAYMENTS.md §8):
//   фаза 2 — stars.js, фаза 3 — yookassa.js, фаза 4 — tribute.js, фаза 5 — paddle.js

import { AppError } from '../../../middleware/errorHandler.js'
import { createMockProvider } from './mock.js'

export function createPaymentProvider(name) {
  switch (name) {
    case 'mock':
      return createMockProvider()
    default:
      throw new AppError(400, 'METHOD_UNAVAILABLE', `Способ оплаты «${name}» пока не подключён`)
  }
}
