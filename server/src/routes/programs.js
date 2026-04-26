import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { getActive, getNextWorkout } from '../controllers/programController.js'

const router = Router()

router.use(telegramAuth)

router.get('/active', getActive)
router.get('/active/next-workout', getNextWorkout)

export default router
