import { z } from 'zod'

import prisma from '../utils/prisma.js'
import { getUserTimezone } from '../utils/dateUtils.js'
import { track } from '../utils/analytics.js'
import { notify, getBotLink } from '../bot/notifier.js'
import {
  createPendingContext,
  buildNudge,
  VALID_CONTEXT_TYPES,
} from '../services/aiTrainer/chatContext.js'

const contextSchema = z.object({
  type: z.enum(VALID_CONTEXT_TYPES),
  refId: z.string().uuid().optional(),
})

/**
 * POST /api/v1/chat/context
 *
 * Handoff контекста из мини-аппа в чат-бота (фаза 2.2): сохраняет, о чём юзер
 * хочет спросить, проактивно подсказывает в боте и возвращает t.me-ссылку,
 * которую фронт открывает через openTelegramLink.
 */
export async function postContext(req, res) {
  const { type, refId } = contextSchema.parse(req.body)
  const userId = req.user.id

  const { id, name } = await createPendingContext(userId, type, refId)

  // Проактивная подсказка + сохранение в историю чата (для непрерывности диалога).
  // Fire-and-forget: недоступность бота не должна ронять ответ мини-аппу.
  const nudge = buildNudge(type, name)
  notify(req.user.telegramId, nudge)
    .then((sent) => {
      if (sent) {
        return prisma.chatMessage.create({
          data: { userId, role: 'assistant', content: nudge },
        })
      }
    })
    .catch((err) => console.error('[chat] context nudge failed:', err.message))

  track(userId, 'chat_context', { type, hasRef: Boolean(refId) })

  res.json({ ok: true, contextId: id, link: getBotLink() })
}
