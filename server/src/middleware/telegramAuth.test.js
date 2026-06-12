import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// Mock prisma before importing the module under test
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: 'user-1', telegramId: 0n }),
    },
  },
}))

vi.mock('../utils/analytics.js', () => ({
  track: vi.fn(),
}))

const { telegramAuth } = await import('./telegramAuth.js')

function mockReq(authHeader) {
  return {
    header: (name) => {
      if (name.toLowerCase() === 'authorization') return authHeader
      return null
    },
    path: '/api/v1/test',
  }
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res },
  }
  return res
}

function buildValidInitData(botToken, overrides = {}) {
  const authDate = overrides.auth_date ?? Math.floor(Date.now() / 1000)
  const user = JSON.stringify(overrides.user ?? { id: 123, first_name: 'Test', username: 'tester' })
  const params = new URLSearchParams({ user, auth_date: String(authDate), query_id: 'test' })

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  params.set('hash', hash)
  return params.toString()
}

describe('telegramAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = mockReq(null)
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('Missing Authorization')
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header does not start with tma', async () => {
    const req = mockReq('Bearer some-token')
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('allows dev_bypass when ALLOW_DEV_BYPASS=true', async () => {
    vi.stubEnv('ALLOW_DEV_BYPASS', 'true')
    const req = mockReq('tma dev_bypass')
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeDefined()
  })

  it('rejects dev_bypass when ALLOW_DEV_BYPASS is not set', async () => {
    delete process.env.ALLOW_DEV_BYPASS
    const req = mockReq('tma dev_bypass')
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('dev_bypass is disabled')
    expect(next).not.toHaveBeenCalled()
  })

  it('validates correct HMAC-SHA256 initData', async () => {
    const botToken = 'test-bot-token:12345'
    vi.stubEnv('BOT_TOKEN', botToken)

    const initData = buildValidInitData(botToken)
    const req = mockReq(`tma ${initData}`)
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeDefined()
  })

  it('rejects initData with invalid hash', async () => {
    vi.stubEnv('BOT_TOKEN', 'test-bot-token:12345')

    const params = new URLSearchParams({
      user: JSON.stringify({ id: 123, first_name: 'Test' }),
      auth_date: String(Math.floor(Date.now() / 1000)),
      hash: 'invalidhash123',
    })

    const req = mockReq(`tma ${params.toString()}`)
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('hash mismatch')
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects expired initData (auth_date > 24h ago)', async () => {
    const botToken = 'test-bot-token:12345'
    vi.stubEnv('BOT_TOKEN', botToken)

    const expiredAuthDate = Math.floor(Date.now() / 1000) - 86401
    const initData = buildValidInitData(botToken, { auth_date: expiredAuthDate })
    const req = mockReq(`tma ${initData}`)
    const res = mockRes()
    const next = vi.fn()

    await telegramAuth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('expired')
    expect(next).not.toHaveBeenCalled()
  })
})
