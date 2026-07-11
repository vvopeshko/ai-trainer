import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { initAuth } from '../controllers/authController.js'
import { listProviders, setPassword, handoff } from '../controllers/webAuthController.js'

const router = Router()

// Публичные (до auth middleware)
router.get('/providers', listProviders)
router.get('/handoff', authLimiter, handoff) // OAuth → SPA (при включённых Google/Yandex)

router.use(auth)

router.post('/init', initAuth)
router.post('/set-password', authLimiter, setPassword)

export default router
