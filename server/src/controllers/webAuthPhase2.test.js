import { describe, it, expect, vi, beforeEach } from 'vitest'

// Фаза 2: вход через Login Widget, привязка/отвязка Telegram, adoption
// в обе стороны, revoke sessions. HMAC-валидация покрыта в utils/telegramWidget.test.js —
// здесь она мокается.

const mocks = vi.hoisted(() => {
  const tx = {
    user: { update: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}) },
    account: { updateMany: vi.fn().mockResolvedValue({}) },
    session: { deleteMany: vi.fn().mockResolvedValue({}) },
  }
  return {
    tx,
    prisma: {
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      account: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn() },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      workout: { count: vi.fn().mockResolvedValue(0) },
      program: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(async (fn) => fn(tx)),
    },
    ctx: {
      internalAdapter: { createSession: vi.fn().mockResolvedValue({ token: 'ba-session-token' }) },
      password: { verify: vi.fn().mockResolvedValue(true) },
    },
    enabledProviders: vi.fn(() => ['email', 'telegram_widget']),
    validateWidgetData: vi.fn(),
  }
})

vi.mock('../utils/prisma.js', () => ({ default: mocks.prisma }))
vi.mock('../utils/analytics.js', () => ({ track: vi.fn() }))
vi.mock('../utils/telegramWidget.js', () => ({ validateWidgetData: mocks.validateWidgetData }))
vi.mock('../bot/notifier.js', () => ({ getBotUsername: () => 'test_bot' }))
vi.mock('../auth/index.js', () => ({
  auth: { $context: Promise.resolve(mocks.ctx), api: {} },
  enabledProviders: mocks.enabledProviders,
}))

const { telegramWidget, linkTelegram, unlinkTelegram, adoptAccount, adoptByPassword, revokeSessions, listProviders } =
  await import('./webAuthController.js')

function mockReq(body, user) {
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

const WIDGET_OK = { ok: true, user: { id: 42, first_name: 'Vik', username: 'vik', photo_url: null } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabledProviders.mockReturnValue(['email', 'telegram_widget'])
  mocks.validateWidgetData.mockReturnValue(WIDGET_OK)
  mocks.prisma.workout.count.mockResolvedValue(0)
  mocks.prisma.program.count.mockResolvedValue(0)
  mocks.prisma.account.count.mockResolvedValue(0)
  mocks.prisma.$transaction.mockImplementation(async (fn) => fn(mocks.tx))
  mocks.ctx.internalAdapter.createSession.mockResolvedValue({ token: 'ba-session-token' })
  mocks.ctx.password.verify.mockResolvedValue(true) // mockResolvedValue переживает clearAllMocks
})

describe('listProviders (с виджетом)', () => {
  it('отдаёт botUsername при включённом telegram_widget', () => {
    const res = mockRes()
    listProviders({}, res)
    expect(res.body).toEqual({ providers: ['email', 'telegram_widget'], botUsername: 'test_bot' })
  })
})

describe('telegramWidget (вход)', () => {
  it('провайдер выключен → 503', async () => {
    mocks.enabledProviders.mockReturnValue(['email'])
    const res = mockRes()
    await telegramWidget(mockReq({}), res, vi.fn())
    expect(res.statusCode).toBe(503)
  })

  it('невалидный HMAC → 401', async () => {
    mocks.validateWidgetData.mockReturnValue({ ok: false, error: 'widget hash mismatch' })
    const res = mockRes()
    await telegramWidget(mockReq({}), res, vi.fn())
    expect(res.statusCode).toBe(401)
  })

  it('валидные данные → upsert по telegramId (account НЕ создаётся) + токен', async () => {
    mocks.prisma.user.upsert.mockResolvedValue({ id: 'tg-user' })
    const res = mockRes()
    await telegramWidget(mockReq({ id: 42, hash: 'x' }), res, vi.fn())
    expect(mocks.prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { telegramId: 42n }, update: {} }),
    )
    expect(mocks.ctx.internalAdapter.createSession).toHaveBeenCalledWith('tg-user')
    expect(res.body).toEqual({ token: 'ba-session-token' })
  })
})

describe('linkTelegram', () => {
  const webUser = { id: 'web-1', telegramId: null, email: 'w@x.co', username: null, photoUrl: null }

  it('telegramId свободен → пишется на текущего юзера', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await linkTelegram(mockReq({}, webUser), res, vi.fn())
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'web-1' }, data: expect.objectContaining({ telegramId: 42n }) }),
    )
    expect(res.body).toEqual({ ok: true })
  })

  it('занят другим + текущий ПУСТ → 409 adoptable:true', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'OTHER' })
    const res = mockRes()
    await linkTelegram(mockReq({}, webUser), res, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'telegram_linked_elsewhere', adoptable: true })
  })

  it('занят другим + текущий НЕ пуст → adoptable:false', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'OTHER' })
    mocks.prisma.workout.count.mockResolvedValue(3)
    const res = mockRes()
    await linkTelegram(mockReq({}, webUser), res, vi.fn())
    expect(res.body).toEqual({ error: 'telegram_linked_elsewhere', adoptable: false })
  })

  it('к аккаунту уже привязан другой Telegram → 409', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await linkTelegram(mockReq({}, { ...webUser, telegramId: 777n }), res, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('another_telegram_linked')
  })
})

describe('unlinkTelegram', () => {
  it('не привязан → 400', async () => {
    const res = mockRes()
    await unlinkTelegram(mockReq({}, { id: 'u', telegramId: null }), res, vi.fn())
    expect(res.statusCode).toBe(400)
  })

  it('последний метод входа → 400 last_method', async () => {
    mocks.prisma.account.count.mockResolvedValue(0) // 0 аккаунтов + telegram = 1 метод
    const res = mockRes()
    await unlinkTelegram(mockReq({}, { id: 'u', telegramId: 42n }), res, vi.fn())
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('last_method')
  })

  it('есть второй метод → telegramId обнуляется', async () => {
    mocks.prisma.account.count.mockResolvedValue(1) // credential
    const res = mockRes()
    await unlinkTelegram(mockReq({}, { id: 'u', telegramId: 42n }), res, vi.fn())
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u' }, data: { telegramId: null } })
    expect(res.body).toEqual({ ok: true })
  })
})

describe('adoptAccount (web: пустой аккаунт → аккаунт с данными)', () => {
  const emptyWebUser = { id: 'empty-1', telegramId: null, email: 'w@x.co', emailVerified: true }
  const donor = { id: 'donor-1', telegramId: 42n, email: null }

  it('донор не найден → 400', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await adoptAccount(mockReq({}, emptyWebUser), res, vi.fn())
    expect(res.statusCode).toBe(400)
  })

  it('текущий аккаунт НЕ пуст → 409, транзакция не запускается', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(donor)
    mocks.prisma.program.count.mockResolvedValue(1)
    const res = mockRes()
    await adoptAccount(mockReq({}, emptyWebUser), res, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('happy path: переносит аккаунты и email, удаляет пустого, отдаёт токен донора', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(donor)
    const res = mockRes()
    await adoptAccount(mockReq({}, emptyWebUser), res, vi.fn())

    // email освобождён на пустом ДО записи на донора (unique)
    expect(mocks.tx.user.update).toHaveBeenCalledWith({ where: { id: 'empty-1' }, data: { email: null } })
    expect(mocks.tx.account.updateMany).toHaveBeenCalledWith({
      where: { userId: 'empty-1' },
      data: { userId: 'donor-1' },
    })
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'donor-1' },
      data: { email: 'w@x.co', emailVerified: true },
    })
    expect(mocks.tx.user.delete).toHaveBeenCalledWith({ where: { id: 'empty-1' } })
    expect(mocks.ctx.internalAdapter.createSession).toHaveBeenCalledWith('donor-1')
    expect(res.body).toEqual({ token: 'ba-session-token' })
  })

  it('у обоих разный email → 409 email_conflict', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ ...donor, email: 'other@x.co' })
    const res = mockRes()
    await adoptAccount(mockReq({}, emptyWebUser), res, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('email_conflict')
  })
})

describe('adoptByPassword (Mini App: входы пустого веб-аккаунта → текущий)', () => {
  const tgUser = { id: 'tg-1', telegramId: 42n, email: null }
  const webDonor = { id: 'web-1', email: 'w@x.co', emailVerified: true }

  beforeEach(() => {
    mocks.prisma.user.findUnique.mockResolvedValue(webDonor)
    mocks.prisma.account.findFirst.mockResolvedValue({ password: 'hash' })
  })

  it('несуществующий email → 401 generic', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await adoptByPassword(mockReq({ email: 'no@x.co', password: 'longenough' }, tgUser), res, vi.fn())
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('invalid_credentials')
  })

  it('неверный пароль → 401 generic', async () => {
    mocks.ctx.password.verify.mockResolvedValue(false)
    const res = mockRes()
    await adoptByPassword(mockReq({ email: 'w@x.co', password: 'wrongwrong1' }, tgUser), res, vi.fn())
    expect(res.statusCode).toBe(401)
  })

  it('веб-аккаунт НЕ пуст → 409', async () => {
    mocks.prisma.workout.count.mockResolvedValue(5)
    const res = mockRes()
    await adoptByPassword(mockReq({ email: 'w@x.co', password: 'longenough' }, tgUser), res, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('account_not_empty')
  })

  it('happy path: переносит credential + email на TG-юзера, удаляет веб-аккаунт', async () => {
    const res = mockRes()
    await adoptByPassword(mockReq({ email: 'w@x.co', password: 'longenough' }, tgUser), res, vi.fn())

    expect(mocks.tx.user.update).toHaveBeenCalledWith({ where: { id: 'web-1' }, data: { email: null } })
    expect(mocks.tx.account.updateMany).toHaveBeenCalledWith({
      where: { userId: 'web-1' },
      data: { userId: 'tg-1' },
    })
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'tg-1' },
      data: { email: 'w@x.co', emailVerified: true },
    })
    expect(mocks.tx.user.delete).toHaveBeenCalledWith({ where: { id: 'web-1' } })
    expect(res.body).toEqual({ ok: true, email: 'w@x.co' })
  })

  it('у текущего уже есть credential → 409 (не плодим дубли)', async () => {
    mocks.prisma.account.count.mockResolvedValue(1)
    const res = mockRes()
    await adoptByPassword(mockReq({ email: 'w@x.co', password: 'longenough' }, tgUser), res, vi.fn())
    expect(res.statusCode).toBe(409)
  })
})

describe('revokeSessions', () => {
  it('удаляет все BA-сессии юзера', async () => {
    const res = mockRes()
    await revokeSessions(mockReq({}, { id: 'u1' }), res, vi.fn())
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(res.body).toEqual({ ok: true, revoked: 2 })
  })
})
