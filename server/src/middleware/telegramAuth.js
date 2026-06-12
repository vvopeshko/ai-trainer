import crypto from 'node:crypto'
import prisma from '../utils/prisma.js'
import { track } from '../utils/analytics.js'

// Middleware: валидация Telegram initData и upsert User в req.user.
// Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// Заголовок ожидается в формате: Authorization: tma <initData>
// В dev-окружении принимается специальное значение: Authorization: tma dev_bypass

const DEV_BYPASS_VALUE = 'dev_bypass'

// Debounce: обновляем lastSeenAt и шлём track('user_seen') не чаще раза в 5 мин на юзера
const userLastSeen = new Map() // userId → timestamp
const SEEN_INTERVAL = 5 * 60 * 1000

export async function telegramAuth(req, res, next) {
  try {
    const auth = req.header('authorization') || req.header('Authorization')
    if (!auth || !auth.startsWith('tma ')) {
      return res.status(401).json({ error: 'Missing Authorization: tma <initData>' })
    }
    const raw = auth.slice(4).trim()

    let tgUser

    if (raw === DEV_BYPASS_VALUE) {
      if (process.env.ALLOW_DEV_BYPASS !== 'true') {
        return res.status(401).json({ error: 'dev_bypass is disabled' })
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

    // Upsert User по telegramId — update: {} пустой, чтобы не писать в БД на каждый запрос
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
      update: {},
    })

    req.user = user

    // Fire-and-forget lastSeenAt + analytics раз в 5 мин
    const now = Date.now()
    const lastSeen = userLastSeen.get(user.id)
    if (!lastSeen || now - lastSeen > SEEN_INTERVAL) {
      userLastSeen.set(user.id, now)
      prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {})
      track(user.id, 'user_seen', { path: req.path })
    }

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

  const computedBuf = Buffer.from(computedHash, 'hex')
  const receivedBuf = Buffer.from(receivedHash, 'hex')
  if (computedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(computedBuf, receivedBuf)) {
    return { ok: false, error: 'initData hash mismatch' }
  }

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return { ok: false, error: 'initData is expired' }
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
