// Короткий in-process кэш req.user для auth middleware.
//
// Без него каждый запрос платил 1–2 round trip до Neon (upsert юзера / сессия BA
// + перечитывание юзера) ещё до хендлера. Ключи: `tg:<telegramId>` и
// `bearer:<token>`. Правила свежести:
//   - кэшируются только GET-запросы; мутирующий запрос всегда читает юзера из БД
//     и после ответа сбрасывает все его записи (invalidateUser);
//   - TTL 30 с — потолок рассинхрона для изменений вне HTTP (бот, шедулер, админка)
//     и для отзыва сессии с другого устройства.

const TTL_MS = 30_000
const MAX_ENTRIES = 5000

const entries = new Map() // key → { user, expiresAt }

export function getCachedUser(key) {
  const entry = entries.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key)
    return null
  }
  return entry.user
}

export function setCachedUser(key, user, ttlMs = TTL_MS) {
  if (!user || ttlMs <= 0) return
  if (entries.size >= MAX_ENTRIES) prune()
  entries.set(key, { user, expiresAt: Date.now() + Math.min(ttlMs, TTL_MS) })
}

export function invalidateKey(key) {
  entries.delete(key)
}

export function invalidateUser(userId) {
  if (!userId) return
  for (const [key, entry] of entries) {
    if (entry.user.id === userId) entries.delete(key)
  }
}

export function clearUserCache() {
  entries.clear()
}

function prune() {
  const now = Date.now()
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key)
  }
  // Всё ещё полон — выкидываем самые старые (Map хранит порядок вставки)
  for (const key of entries.keys()) {
    if (entries.size < MAX_ENTRIES) break
    entries.delete(key)
  }
}

// Мутирующий запрос: юзер мог измениться (email, telegramId, слияние аккаунтов,
// отзыв сессий) — после ответа сбрасываем все его записи.
export function invalidateAfterMutation(req, res) {
  if (req.method === 'GET' || typeof res.on !== 'function') return
  res.on('finish', () => invalidateUser(req.user?.id))
}
