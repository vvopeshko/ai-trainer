import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { getMonth, getYear } from '../controllers/statsController.js'

const router = Router()

router.use(telegramAuth)

router.get('/month', getMonth)
router.get('/year', getYear)

export default router
