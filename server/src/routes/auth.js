import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { initAuth } from '../controllers/authController.js'

const router = Router()

router.use(telegramAuth)

router.post('/init', initAuth)

export default router
