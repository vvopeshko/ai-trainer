import { Router } from 'express'
import authRoutes from './auth.js'

const router = Router()

router.use('/auth', authRoutes)

// Сюда подключаем следующие роуты по мере работы:
//   router.use('/workouts', workoutRoutes)
//   router.use('/exercises', exerciseRoutes)
//   router.use('/programs', programRoutes)
//   router.use('/chat', chatRoutes)
//   router.use('/analytics', analyticsRoutes)

export default router
