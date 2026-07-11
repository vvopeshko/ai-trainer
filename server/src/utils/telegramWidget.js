import crypto from 'node:crypto'

// Валидация данных Telegram Login Widget (вход в web-версию).
// Документация: https://core.telegram.org/widgets/login#checking-authorization
//
// ⚠️ Схема ключа отличается от initData мини-аппа:
//   initData: secret = HMAC-SHA256(bot_token, key='WebAppData')
//   widget:   secret = SHA256(bot_token) — обычный хеш, не HMAC
//
// TTL auth_date — 1 день (виджет-сессии живут дольше initData).

const MAX_AGE_SEC = 86400

/**
 * @param {object} data — payload виджета: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
 * @param {string} botToken
 * @returns {{ ok: true, user: object } | { ok: false, error: string }}
 */
export function validateWidgetData(data, botToken) {
  if (!botToken) return { ok: false, error: 'BOT_TOKEN is not set on server' }
  if (!data || typeof data !== 'object') return { ok: false, error: 'widget data is missing' }

  const { hash, ...fields } = data
  if (!hash || typeof hash !== 'string') return { ok: false, error: 'widget data has no hash' }

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const computedBuf = Buffer.from(computedHash, 'hex')
  let receivedBuf
  try {
    receivedBuf = Buffer.from(hash, 'hex')
  } catch {
    return { ok: false, error: 'widget hash is not hex' }
  }
  if (computedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(computedBuf, receivedBuf)) {
    return { ok: false, error: 'widget hash mismatch' }
  }

  const authDate = Number(fields.auth_date)
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) {
    return { ok: false, error: 'widget data is expired' }
  }

  const id = Number(fields.id)
  if (!id) return { ok: false, error: 'widget data has no id' }

  return {
    ok: true,
    user: {
      id,
      first_name: fields.first_name,
      last_name: fields.last_name,
      username: fields.username,
      photo_url: fields.photo_url,
    },
  }
}
