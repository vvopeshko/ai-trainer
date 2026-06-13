import { Router } from 'express'
import authRoutes from './auth.js'
import exerciseRoutes from './exercises.js'
import workoutRoutes from './workouts.js'
import statsRoutes from './stats.js'
import programRoutes from './programs.js'
import progressRoutes from './progress.js'
import chatRoutes from './chat.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/exercises', exerciseRoutes)
router.use('/workouts', workoutRoutes)
router.use('/stats', statsRoutes)
router.use('/programs', programRoutes)
router.use('/progress', progressRoutes)
router.use('/chat', chatRoutes)

// Примечание: сам диалог тренера живёт в Telegram-боте; /chat/context — только
// handoff контекста из мини-аппа (фаза 2.2). /analytics — при реализации.

export default router
