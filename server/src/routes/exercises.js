import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { requirePremium } from '../middleware/requirePremium.js'
import { list, search, getById, getHistory, getProgressOverview, batchLastResults, getAllSettings, upsertSettings } from '../controllers/exerciseController.js'

const router = Router()

router.use(auth)
router.use(requirePremium) // hard paywall (PREMIUM_GATING)

router.get('/', list)
router.get('/search', search)
router.get('/settings', getAllSettings)
router.put('/settings/:slug', upsertSettings)
router.get('/progress-overview', getProgressOverview) // before /:id
router.get('/:id/history', getHistory)
router.get('/:id', getById)
router.post('/batch-last-results', batchLastResults)

export default router
