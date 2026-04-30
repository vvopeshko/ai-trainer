import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { listPrograms, getActive, getNextWorkout, getProgram, updateProgram, activateProgram } from '../controllers/programController.js'

const router = Router()

router.use(telegramAuth)

router.get('/', listPrograms)
router.get('/active', getActive)
router.get('/active/next-workout', getNextWorkout)
router.get('/:id', getProgram)
router.patch('/:id', updateProgram)
router.post('/:id/activate', activateProgram)

export default router
