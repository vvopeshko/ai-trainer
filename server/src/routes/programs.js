import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { llmLimiter } from '../middleware/rateLimiter.js'
import { listPrograms, getActive, getNextWorkout, getProgram, updateProgram, activateProgram, importProgramHandler } from '../controllers/programController.js'

const router = Router()

router.use(telegramAuth)

router.get('/', listPrograms)
router.get('/active', getActive)
router.get('/active/next-workout', getNextWorkout)
router.post('/import', llmLimiter, importProgramHandler)
router.get('/:id', getProgram)
router.patch('/:id', updateProgram)
router.post('/:id/activate', activateProgram)

export default router
