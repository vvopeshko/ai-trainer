import { describe, it, expect, vi, beforeEach } from 'vitest'

// Единый auth middleware: tma → telegramAuth, Bearer → Better Auth, иначе 401.

vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: 'tg-user', telegramId: 0n }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('../utils/analytics.js', () => ({
  track: vi.fn(),
}))

vi.mock('../auth/index.js', () => ({
  auth: { api: { getSession: vi.fn() } },
  enabledProviders: vi.fn(() => ['email']),
}))

const prisma = (await import('../utils/prisma.js')).default
const { auth: betterAuth } = await import('../auth/index.js')
const { auth } = await import('./auth.js')

function mockReq(authHeader) {
  return {
    header: (name) => {
      const n = name.toLowerCase()
      if (n === 'authorization') return authHeader
      return null
    },
    headers: authHeader ? { authorization: authHeader } : {},
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

describe('auth (единый middleware)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('без заголовка → 401', async () => {
    const res = mockRes()
    const next = vi.fn()
    await auth(mockReq(undefined), res, next)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('мусорный заголовок (не tma и не Bearer) → 401', async () => {
    const res = mockRes()
    const next = vi.fn()
    await auth(mockReq('Basic dXNlcjpwYXNz'), res, next)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('tma → делегирует telegramAuth (dev_bypass проходит)', async () => {
    vi.stubEnv('ALLOW_DEV_BYPASS', 'true')
    const req = mockReq('tma dev_bypass')
    const res = mockRes()
    const next = vi.fn()
    await auth(req, res, next)
    expect(next).toHaveBeenCalledWith() // без ошибки
    expect(req.user).toEqual({ id: 'tg-user', telegramId: 0n })
    expect(betterAuth.api.getSession).not.toHaveBeenCalled()
  })

  it('Bearer с валидной сессией → req.user из prisma, next()', async () => {
    betterAuth.api.getSession.mockResolvedValue({ user: { id: 'web-user' } })
    prisma.user.findUnique.mockResolvedValue({ id: 'web-user', telegramId: null, email: 'a@b.c' })
    const req = mockReq('Bearer valid-token')
    const res = mockRes()
    const next = vi.fn()
    await auth(req, res, next)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'web-user' } })
    expect(req.user).toMatchObject({ id: 'web-user', telegramId: null })
    expect(next).toHaveBeenCalledWith()
  })

  it('Bearer с просроченной/невалидной сессией → 401', async () => {
    betterAuth.api.getSession.mockResolvedValue(null)
    const res = mockRes()
    const next = vi.fn()
    await auth(mockReq('Bearer expired-token'), res, next)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('Bearer: сессия есть, юзер удалён из БД → 401', async () => {
    betterAuth.api.getSession.mockResolvedValue({ user: { id: 'ghost' } })
    prisma.user.findUnique.mockResolvedValue(null)
    const res = mockRes()
    const next = vi.fn()
    await auth(mockReq('Bearer orphan-token'), res, next)
    expect(res.statusCode).toBe(401)
  })

  it('Bearer: ошибка getSession → next(err), не 500-паника', async () => {
    const boom = new Error('db down')
    betterAuth.api.getSession.mockRejectedValue(boom)
    const res = mockRes()
    const next = vi.fn()
    await auth(mockReq('Bearer token'), res, next)
    expect(next).toHaveBeenCalledWith(boom)
  })
})

describe('auth (web-auth выключен: BETTER_AUTH_SECRET не задан)', () => {
  it('Bearer → 401 Web auth is not configured', async () => {
    vi.resetModules()
    vi.doMock('../auth/index.js', () => ({ auth: null, enabledProviders: () => [] }))
    const { auth: authDisabled } = await import('./auth.js')
    const res = mockRes()
    const next = vi.fn()
    await authDisabled(mockReq('Bearer token'), res, next)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toMatch(/not configured/i)
    vi.doUnmock('../auth/index.js')
  })
})
