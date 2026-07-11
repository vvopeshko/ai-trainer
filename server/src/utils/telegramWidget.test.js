import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { validateWidgetData } from './telegramWidget.js'

// Валидация Login Widget: ключ = SHA256(bot_token) — простой хеш, не HMAC.

const BOT_TOKEN = '123456:TEST-token'

function buildWidgetData(overrides = {}) {
  const fields = {
    id: '424242',
    first_name: 'Vik',
    username: 'vik_test',
    auth_date: String(Math.floor(Date.now() / 1000)),
    ...overrides,
  }
  // hash считаем от исходных полей (до подмены, если тест подменяет после)
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return { ...fields, hash }
}

describe('validateWidgetData', () => {
  it('валидные данные проходят, user распаршен', () => {
    const res = validateWidgetData(buildWidgetData(), BOT_TOKEN)
    expect(res.ok).toBe(true)
    expect(res.user).toMatchObject({ id: 424242, first_name: 'Vik', username: 'vik_test' })
  })

  it('подмена поля после подписи → reject', () => {
    const data = buildWidgetData()
    data.id = '999999' // hash считался для 424242
    const res = validateWidgetData(data, BOT_TOKEN)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/mismatch/)
  })

  it('чужой bot_token → reject', () => {
    const res = validateWidgetData(buildWidgetData(), 'another:token')
    expect(res.ok).toBe(false)
  })

  it('старый auth_date (>1 дня) → reject', () => {
    const old = String(Math.floor(Date.now() / 1000) - 86401)
    const res = validateWidgetData(buildWidgetData({ auth_date: old }), BOT_TOKEN)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/expired/)
  })

  it('без hash / без токена / мусор → reject без исключений', () => {
    expect(validateWidgetData({ id: '1' }, BOT_TOKEN).ok).toBe(false)
    expect(validateWidgetData(buildWidgetData(), '').ok).toBe(false)
    expect(validateWidgetData(null, BOT_TOKEN).ok).toBe(false)
    expect(validateWidgetData({ ...buildWidgetData(), hash: 'не-hex!' }, BOT_TOKEN).ok).toBe(false)
  })

  it('данные без id → reject', () => {
    const fields = { first_name: 'X', auth_date: String(Math.floor(Date.now() / 1000)) }
    const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n')
    const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
    const res = validateWidgetData({ ...fields, hash }, BOT_TOKEN)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/no id/)
  })
})
