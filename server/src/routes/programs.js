import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { getActive, getNextWorkout, getProgram, updateProgram } from '../controllers/programController.js'

const router = Router()

router.use(telegramAuth)

router.get('/active', getActive)
router.get('/active/next-workout', getNextWorkout)
router.get('/:id', getProgram)
router.patch('/:id', updateProgram)

export default router
