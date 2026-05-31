import { Router } from 'express'
import authRoutes from './auth.js'
import exerciseRoutes from './exercises.js'
import workoutRoutes from './workouts.js'
import statsRoutes from './stats.js'
import programRoutes from './programs.js'
import progressRoutes from './progress.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/exercises', exerciseRoutes)
router.use('/workouts', workoutRoutes)
router.use('/stats', statsRoutes)
router.use('/programs', programRoutes)
router.use('/progress', progressRoutes)

// TODO: /chat (AI-тренер диалог) и /analytics (серверная аналитика) — подключить при реализации

export default router
