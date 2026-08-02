import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { requirePremium } from '../middleware/requirePremium.js'
import { create, getActive, getRecent, getById, logSet, deleteSet, update, destroy } from '../controllers/workoutController.js'

const router = Router()

router.use(auth)
router.use(requirePremium) // hard paywall (PREMIUM_GATING)

router.post('/', create)
router.get('/active', getActive)
router.get('/recent', getRecent)
router.get('/:id', getById)
router.post('/:id/sets', logSet)
router.delete('/:id/sets/:setId', deleteSet)
router.patch('/:id', update)
router.delete('/:id', destroy)

export default router
