import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { getStatus, getPlans, checkout, postRedeemPromo, postCancel } from '../controllers/billingController.js'

// /api/v1/billing/* — доступно БЕЗ подписки (paywall должен работать), но под auth.
// Вебхуки провайдеров (фазы 3-5) сюда не попадут: raw-body роуты монтируются
// в index.js ДО express.json() (паттерн Better Auth).

const router = Router()

router.use(auth)

router.get('/status', getStatus)
router.get('/plans', getPlans)
// Подбор промокодов и спам чекаутов — под строгий per-IP лимит (10 req/мин)
router.post('/checkout', authLimiter, checkout)
router.post('/promo/redeem', authLimiter, postRedeemPromo)
router.post('/cancel', authLimiter, postCancel)

export default router
