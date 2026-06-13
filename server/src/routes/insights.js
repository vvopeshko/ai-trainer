import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { getDailyInsight } from '../controllers/insightsController.js'

const router = Router()

router.use(telegramAuth)

router.get('/today', getDailyInsight)

export default router
