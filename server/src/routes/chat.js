import { Router } from 'express'
import { telegramAuth } from '../middleware/telegramAuth.js'
import { postContext } from '../controllers/chatController.js'

const router = Router()

router.use(telegramAuth)

// Сам диалог живёт в Telegram-боте (фаза 2.1). Здесь только handoff контекста
// из мини-аппа: «спросить про это упражнение/программу» (фаза 2.2).
router.post('/context', postContext)

export default router
