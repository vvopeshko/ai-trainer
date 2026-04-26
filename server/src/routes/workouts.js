import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { create, getActive, getRecent, getById, logSet, deleteSet, finish } from '../controllers/workoutController.js'

const router = Router()

router.use(telegramAuth)

router.post('/', create)
router.get('/active', getActive)
router.get('/recent', getRecent)
router.get('/:id', getById)
router.post('/:id/sets', logSet)
router.delete('/:id/sets/:setId', deleteSet)
router.patch('/:id', finish)

export default router
