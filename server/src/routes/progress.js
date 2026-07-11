import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { getProgress, getProgressInsights } from '../controllers/progressController.js'

const router = Router()

router.use(auth)

router.get('/', getProgress)
router.get('/insights', getProgressInsights)

export default router
