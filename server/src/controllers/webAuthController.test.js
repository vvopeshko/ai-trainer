import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'

// setPassword: мост из Mini App в веб (tma-юзер задаёт email+пароль).

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
  ctx: {
    password: { hash: vi.fn().mockResolvedValue('scrypt-hash') },
    internalAdapter: {
      findAccounts: vi.fn().mockResolvedValue([]),
      linkAccount: vi.fn().mockResolvedValue({}),
      updatePassword: vi.fn().mockResolvedValue({}),
    },
  },
  api: { sendVerificationEmail: vi.fn().mockResolvedValue({}) },
  enabledProviders: vi.fn(() => ['email']),
}))

vi.mock('../utils/prisma.js', () => ({ default: mocks.prisma }))
vi.mock('../utils/analytics.js', () => ({ track: vi.fn() }))
vi.mock('../auth/index.js', () => ({
  auth: { $context: Promise.resolve(mocks.ctx), api: mocks.api },
  enabledProviders: mocks.enabledProviders,
}))

const { setPassword, listProviders } = await import('./webAuthController.js')

function mockReq(body, user = { id: 'u1', email: null, telegramId: 42n }) {
  return { body, user, header: () => null }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res },
  }
  return res
}

describe('listProviders', () => {
  it('отдаёт активные провайдеры', () => {
    const res = mockRes()
    listProviders({}, res)
    expect(res.body).toEqual({ providers: ['email'] })
  })
})

describe('setPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enabledProviders.mockReturnValue(['email'])
    mocks.ctx.internalAdapter.findAccounts.mockResolvedValue([])
    mocks.prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.email) return Promise.resolve(null) // email свободен
      return Promise.resolve({ id: 'u1', email: 'new@example.com', emailVerified: false })
    })
  })

  it('email-провайдер выключен → 503', async () => {
    mocks.enabledProviders.mockReturnValue([])
    const res = mockRes()
    await setPassword(mockReq({ email: 'a@b.co', password: 'longenough' }), res, vi.fn())
    expect(res.statusCode).toBe(503)
  })

  it('создаёт credential-account + email + письмо верификации (tma-юзер)', async () => {
    const res = mockRes()
    const next = vi.fn()
    await setPassword(mockReq({ email: 'New@Example.com ', password: 'longenough' }), res, next)

    expect(next).not.toHaveBeenCalled()
    // Нормализация: trim + lowercase
    expect(mocks.ctx.internalAdapter.linkAccount).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', providerId: 'credential', password: 'scrypt-hash' }),
    )
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { email: 'new@example.com', emailVerified: false },
    })
    expect(mocks.api.sendVerificationEmail).toHaveBeenCalled()
    expect(res.body).toMatchObject({ ok: true, email: 'new@example.com', verificationSent: true })
  })

  it('повторный вызов с существующим credential → обновляет пароль, не дублирует account', async () => {
    mocks.ctx.internalAdapter.findAccounts.mockResolvedValue([{ providerId: 'credential' }])
    const res = mockRes()
    await setPassword(mockReq({ email: 'new@example.com', password: 'longenough' }), res, vi.fn())
    expect(mocks.ctx.internalAdapter.updatePassword).toHaveBeenCalledWith('u1', 'scrypt-hash')
    expect(mocks.ctx.internalAdapter.linkAccount).not.toHaveBeenCalled()
  })

  it('email занят другим юзером → 409 generic (анти-enumeration)', async () => {
    mocks.prisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.email ? { id: 'OTHER' } : { id: 'u1', emailVerified: false }),
    )
    const res = mockRes()
    await setPassword(mockReq({ email: 'taken@example.com', password: 'longenough' }), res, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'email_unavailable' })
    expect(mocks.ctx.internalAdapter.linkAccount).not.toHaveBeenCalled()
  })

  it('уже верифицированный email → письмо повторно не шлём', async () => {
    mocks.prisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.email ? null : { id: 'u1', email: 'new@example.com', emailVerified: true }),
    )
    const res = mockRes()
    await setPassword(
      mockReq({ email: 'new@example.com', password: 'longenough' }, { id: 'u1', email: 'new@example.com' }),
      res,
      vi.fn(),
    )
    expect(mocks.api.sendVerificationEmail).not.toHaveBeenCalled()
    expect(res.body).toMatchObject({ ok: true, verificationSent: false })
  })

  it('невалидное тело (короткий пароль) → next(ZodError) → 400 через errorHandler', async () => {
    const next = vi.fn()
    await setPassword(mockReq({ email: 'a@b.co', password: 'short' }), mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError)
  })
})
