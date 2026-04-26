import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { create, getActive, getById, logSet, finish } from '../controllers/workoutController.js'

const router = Router()

router.use(telegramAuth)

router.post('/', create)
router.get('/active', getActive)
router.get('/:id', getById)
router.post('/:id/sets', logSet)
router.patch('/:id', finish)

export default router
