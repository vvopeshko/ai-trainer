import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { llmLimiter } from '../middleware/rateLimiter.js'
import { getDailyInsight } from '../controllers/insightsController.js'

const router = Router()

router.use(telegramAuth)

// llmLimiter: инсайт кэшируется по дню, но первый запрос дня — LLM-вызов.
router.get('/today', llmLimiter, getDailyInsight)

export default router
