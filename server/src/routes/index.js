import { Router } from 'express'
import authRoutes from './auth.js'
import exerciseRoutes from './exercises.js'
import workoutRoutes from './workouts.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/exercises', exerciseRoutes)
router.use('/workouts', workoutRoutes)

// Следующие роуты подключаем по мере работы:
//   router.use('/programs', programRoutes)
//   router.use('/stats', statsRoutes)
//   router.use('/chat', chatRoutes)
//   router.use('/analytics', analyticsRoutes)

export default router
