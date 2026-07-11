import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { initAuth } from '../controllers/authController.js'
import {
  listProviders,
  setPassword,
  handoff,
  telegramWidget,
  linkTelegram,
  unlinkTelegram,
  adoptAccount,
  adoptByPassword,
  revokeSessions,
} from '../controllers/webAuthController.js'

const router = Router()

// Публичные (до auth middleware)
router.get('/providers', listProviders)
router.get('/handoff', authLimiter, handoff) // OAuth → SPA (при включённых Google/Yandex)
router.post('/telegram-widget', authLimiter, telegramWidget) // вход через Login Widget

router.use(auth)

router.post('/init', initAuth)
router.post('/set-password', authLimiter, setPassword)
router.post('/telegram/link', authLimiter, linkTelegram)
router.delete('/telegram', unlinkTelegram)
router.post('/adopt', authLimiter, adoptAccount)
router.post('/adopt-by-password', authLimiter, adoptByPassword)
router.delete('/sessions', revokeSessions)

export default router
