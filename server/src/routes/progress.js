import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { getProgress } from '../controllers/progressController.js'

const router = Router()

router.use(telegramAuth)

router.get('/', getProgress)

export default router
