import crypto from 'node:crypto'
import prisma from '../utils/prisma.js'
import { track } from '../utils/analytics.js'

// Middleware: валидация Telegram initData и upsert User в req.user.
// Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// Заголовок ожидается в формате: Authorization: tma <initData>
// В dev-окружении принимается специальное значение: Authorization: tma dev_bypass

const DEV_BYPASS_VALUE = 'dev_bypass'

export async function telegramAuth(req, res, next) {
  try {
    const auth = req.header('authorization') || req.header('Authorization')
    if (!auth || !auth.startsWith('tma ')) {
      return res.status(401).json({ error: 'Missing Authorization: tma <initData>' })
    }
    const raw = auth.slice(4).trim()

    let tgUser

    if (raw === DEV_BYPASS_VALUE) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'dev_bypass is disabled in production' })
      }
      tgUser = {
        id: 0,
        first_name: 'Dev',
        last_name: 'User',
        username: 'dev_user',
        language_code: 'ru',
      }
    } else {
      const parsed = parseAndValidateInitData(raw, process.env.BOT_TOKEN)
      if (!parsed.ok) {
        return res.status(401).json({ error: parsed.error })
      }
      tgUser = parsed.user
    }

    // Upsert User по telegramId.
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        languageCode: tgUser.language_code ?? null,
        photoUrl: tgUser.photo_url ?? null,
      },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        languageCode: tgUser.language_code ?? null,
        photoUrl: tgUser.photo_url ?? null,
        lastSeenAt: new Date(),
        sessionsCount: { increment: 1 },
      },
    })

    req.user = user
    track(user.id, 'user_seen', { path: req.path })
    next()
  } catch (err) {
    next(err)
  }
}

// ─────────────────────────────────────────────────────────────────
// Парсинг и валидация initData (HMAC-SHA256).
// Возвращает { ok: true, user } или { ok: false, error }.
// ─────────────────────────────────────────────────────────────────
function parseAndValidateInitData(initData, botToken) {
  if (!botToken) {
    return { ok: false, error: 'BOT_TOKEN is not set on server' }
  }

  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) return { ok: false, error: 'initData has no hash' }

  params.delete('hash')

  // Канонический dataCheckString: ключи отсортированы, формат key=value\nkey=value
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== receivedHash) {
    return { ok: false, error: 'initData hash mismatch' }
  }

  const userJson = params.get('user')
  if (!userJson) return { ok: false, error: 'initData has no user' }

  try {
    const user = JSON.parse(userJson)
    return { ok: true, user }
  } catch {
    return { ok: false, error: 'initData user is not valid JSON' }
  }
}
