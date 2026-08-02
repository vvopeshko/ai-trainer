import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { requirePremium } from '../middleware/requirePremium.js'
import { getProgress, getProgressInsights } from '../controllers/progressController.js'

const router = Router()

router.use(auth)
router.use(requirePremium) // hard paywall (PREMIUM_GATING)

router.get('/', getProgress)
router.get('/insights', getProgressInsights)

export default router
