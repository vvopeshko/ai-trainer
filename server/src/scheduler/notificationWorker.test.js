import { describe, it, expect, vi, beforeEach } from 'vitest'

// workTick: stale locks → CAS-claim → render (сохранение текста) → доставка.
// Рендереры, notify и push мокаются; проверяем state machine и идемпотентность.

const mocks = vi.hoisted(() => ({
  prisma: {
    notificationJob: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: vi.fn() },
  },
  notify: vi.fn().mockResolvedValue(true),
  sendPushToUser: vi.fn(),
  renderWeekly: vi.fn(),
  renderPostWorkout: vi.fn(),
  claimNotification: vi.fn().mockResolvedValue(true),
}))

vi.mock('../utils/prisma.js', () => ({ default: mocks.prisma }))
vi.mock('../utils/analytics.js', () => ({ track: vi.fn() }))
vi.mock('../bot/notifier.js', () => ({ notify: mocks.notify }))
vi.mock('../services/webPushService.js', () => ({ sendPushToUser: mocks.sendPushToUser }))
vi.mock('../services/aiTrainer/weeklySummary.js', () => ({ renderWeeklySummary: mocks.renderWeekly }))
vi.mock('../services/aiTrainer/postWorkoutSummary.js', () => ({ renderPostWorkoutSummary: mocks.renderPostWorkout }))
vi.mock('./index.js', () => ({ claimNotification: mocks.claimNotification }))

const { workTick } = await import('./notificationWorker.js')

const NOW = new Date('2026-07-12T17:00:00Z')

function job(overrides = {}) {
  return {
    id: 'job-1',
    type: 'weekly',
    channel: 'telegram',
    recipientKey: 'user:u1',
    periodKey: '2026-W28',
    status: 'pending',
    payload: null,
    renderedText: null,
    attempts: 0,
    maxAttempts: 6,
    lockedAt: null,
    ...overrides,
  }
}

const RENDERED = {
  html: '<b>Итоги</b>',
  pushTitle: 'Итоги недели',
  pushBody: 'Так держать',
  url: '/progress',
  buttons: null,
  meta: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.prisma.notificationJob.updateMany.mockResolvedValue({ count: 0 })
  mocks.prisma.notificationJob.update.mockResolvedValue({})
  mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', telegramId: 42n, timezone: null })
  mocks.claimNotification.mockResolvedValue(true)
  mocks.notify.mockResolvedValue(true)
  mocks.renderWeekly.mockResolvedValue(RENDERED)
})

/** Обновления конкретного job'а (без updateMany-клеймов). */
function updatesFor(id) {
  return mocks.prisma.notificationJob.update.mock.calls
    .filter(([arg]) => arg.where.id === id)
    .map(([arg]) => arg.data)
}

describe('workTick', () => {
  it('NOTIFICATION_WORKER=off → не работает', async () => {
    vi.stubEnv('NOTIFICATION_WORKER', 'off')
    const res = await workTick(NOW)
    expect(res.claimed).toBe(0)
    expect(mocks.prisma.notificationJob.findMany).not.toHaveBeenCalled()
  })

  it('happy path telegram: claim → render сохранён → sent + providerRef', async () => {
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job()])
    // 1-й updateMany — восстановление stale locks, 2-й — CAS-claim
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    const res = await workTick(NOW)
    expect(res.claimed).toBe(1)

    const updates = updatesFor('job-1')
    // Рендер сохранён до доставки (retry не вызовет LLM повторно)
    expect(updates[0]).toMatchObject({ renderedText: RENDERED.html, status: 'sending' })
    expect(mocks.notify).toHaveBeenCalledWith(42n, RENDERED.html, { buttons: undefined })
    expect(updates.at(-1)).toMatchObject({ status: 'sent', providerRef: 'tg:sent' })
  })

  it('CAS: проигравший конкуренцию (count=0) job не обрабатывается', async () => {
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job()])
    mocks.prisma.notificationJob.updateMany.mockResolvedValue({ count: 0 }) // и stale, и claim
    const res = await workTick(NOW)
    expect(res.claimed).toBe(0)
    expect(mocks.renderWeekly).not.toHaveBeenCalled()
  })

  it('web_push: доставка на подписки, providerRef=push:N', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', telegramId: null })
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job({ channel: 'web_push' })])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mocks.sendPushToUser.mockResolvedValue({ sent: 2, gone: 0, failed: 0 })

    await workTick(NOW)
    expect(mocks.sendPushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: RENDERED.pushTitle,
      body: RENDERED.pushBody,
      url: '/progress',
    }))
    expect(updatesFor('job-1').at(-1)).toMatchObject({ status: 'sent', providerRef: 'push:2' })
  })

  it('рендер сказал skip → skipped с кодом, доставки нет', async () => {
    mocks.renderWeekly.mockResolvedValue({ skip: 'no_activity' })
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job()])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await workTick(NOW)
    expect(updatesFor('job-1').at(-1)).toMatchObject({ status: 'skipped', errorCode: 'no_activity' })
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('мост идемпотентности: legacy уже отправил (NotificationLog) → skipped', async () => {
    mocks.claimNotification.mockResolvedValue(false)
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job()])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await workTick(NOW)
    expect(updatesFor('job-1').at(-1)).toMatchObject({ status: 'skipped', errorCode: 'already_sent_legacy' })
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('временная ошибка доставки → retry с nextAttemptAt, рендер сохранён', async () => {
    mocks.notify.mockRejectedValue(Object.assign(new Error('ETIMEDOUT'), {}))
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job()])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await workTick(NOW)
    const last = updatesFor('job-1').at(-1)
    expect(last).toMatchObject({ status: 'retry', errorCode: 'network' })
    expect(last.nextAttemptAt).toBeInstanceOf(Date)
  })

  it('permanent (tg 403) → failed без ретраев', async () => {
    mocks.notify.mockRejectedValue({ response: { error_code: 403 }, message: 'Forbidden' })
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job()])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await workTick(NOW)
    expect(updatesFor('job-1').at(-1)).toMatchObject({ status: 'failed', errorCode: 'tg_forbidden' })
  })

  it('retry с готовым renderedText: LLM не вызывается повторно', async () => {
    mocks.prisma.notificationJob.findMany.mockResolvedValue([
      job({ status: 'retry', renderedText: '<b>Готовый текст</b>', attempts: 1, payload: { pushTitle: 'x', url: '/' } }),
    ])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await workTick(NOW)
    expect(mocks.renderWeekly).not.toHaveBeenCalled() // ← ключевое свойство очереди
    expect(mocks.notify).toHaveBeenCalledWith(42n, '<b>Готовый текст</b>', expect.anything())
  })

  it('retry НЕ спотыкается о собственный клейм моста (attempts>1 → без проверки)', async () => {
    // Регрессия: на попытке 1 мост клеймит NotificationLog; повторная проверка
    // на ретрае находила собственный клейм и скипала job навсегда.
    mocks.claimNotification.mockResolvedValue(false) // клейм «занят» (нами же)
    mocks.prisma.notificationJob.findMany.mockResolvedValue([
      job({ status: 'retry', renderedText: 'text', attempts: 1, payload: { pushTitle: 'x', url: '/' } }),
    ])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await workTick(NOW) // после клейма attempts станет 2
    expect(mocks.claimNotification).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalled() // доставка состоялась
    expect(updatesFor('job-1').at(-1)).toMatchObject({ status: 'sent' })
  })

  it('все подписки исчезли → permanent failed no_push_subscriptions', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', telegramId: null })
    mocks.prisma.notificationJob.findMany.mockResolvedValue([job({ channel: 'web_push' })])
    mocks.prisma.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mocks.sendPushToUser.mockResolvedValue({ sent: 0, noSubscriptions: true })

    await workTick(NOW)
    expect(updatesFor('job-1').at(-1)).toMatchObject({ status: 'failed', errorCode: 'no_push_subscriptions' })
  })
})
