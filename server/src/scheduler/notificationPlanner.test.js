import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn() },
    pushSubscription: { count: vi.fn().mockResolvedValue(0) },
    notificationJob: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}))

vi.mock('../utils/prisma.js', () => ({ default: mocks.prisma }))
vi.mock('../services/webPushService.js', () => ({ webPushEnabled: () => true }))

const { planTick, enqueueNotification, pickChannel } = await import('./notificationPlanner.js')

// Вс 2026-07-12 19:05 МСК (16:05 UTC) — weekly-слот due
const SUNDAY_1905_MSK = new Date('2026-07-12T16:05:00Z')
// Ср — не due
const WEDNESDAY = new Date('2026-07-08T16:05:00Z')

function tgUser(id = 'u1') {
  return { id, telegramId: 42n, timezone: 'Europe/Moscow', _count: { pushSubscriptions: 0 } }
}
function webUser(id = 'w1', subs = 1) {
  return { id, telegramId: null, timezone: 'Europe/Moscow', _count: { pushSubscriptions: subs } }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NOTIFICATION_QUEUE', 'on')
  mocks.prisma.notificationJob.createMany.mockResolvedValue({ count: 1 })
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('pickChannel', () => {
  it('telegramId → telegram (даже при наличии подписок)', () => {
    expect(pickChannel({ telegramId: 42n, _count: { pushSubscriptions: 2 } })).toBe('telegram')
  })
  it('без telegram, с подпиской → web_push', () => {
    expect(pickChannel(webUser())).toBe('web_push')
  })
  it('без каналов → null', () => {
    expect(pickChannel(webUser('w', 0))).toBeNull()
  })
})

describe('planTick', () => {
  it('queue=off → ничего не планирует', async () => {
    vi.stubEnv('NOTIFICATION_QUEUE', 'off')
    const res = await planTick(SUNDAY_1905_MSK)
    expect(res.created).toBe(0)
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('вс 19:05 → weekly job для TG-юзера, periodKey = ISO-неделя', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([tgUser()])
    await planTick(SUNDAY_1905_MSK)
    expect(mocks.prisma.notificationJob.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'weekly',
          channel: 'telegram',
          recipientKey: 'user:u1',
          periodKey: '2026-W28',
          timezone: 'Europe/Moscow',
        }),
      ],
      skipDuplicates: true, // идемпотентность на unique-ключе
    })
  })

  it('web-only юзер с подпиской получает канал web_push', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([webUser()])
    await planTick(SUNDAY_1905_MSK)
    const data = mocks.prisma.notificationJob.createMany.mock.calls[0][0].data
    expect(data[0]).toMatchObject({ channel: 'web_push', recipientKey: 'user:w1' })
  })

  it('среда → слот не due, createMany не зовётся', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([tgUser()])
    const res = await planTick(WEDNESDAY)
    expect(res.due).toBe(0)
    expect(mocks.prisma.notificationJob.createMany).not.toHaveBeenCalled()
  })

  it('shadow: jobs создаются сразу skipped:SHADOW_MODE', async () => {
    vi.stubEnv('NOTIFICATION_QUEUE', 'shadow')
    mocks.prisma.user.findMany.mockResolvedValue([tgUser()])
    await planTick(SUNDAY_1905_MSK)
    const data = mocks.prisma.notificationJob.createMany.mock.calls[0][0].data
    expect(data[0]).toMatchObject({ status: 'skipped', errorCode: 'SHADOW_MODE' })
  })

  it('битая timezone учитывается и падает на дефолт', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ ...tgUser(), timezone: 'Junk/Zone' }])
    const res = await planTick(SUNDAY_1905_MSK)
    expect(res.invalidTimezone).toBe(1)
    // На дефолтной МСК слот тоже due — job создан
    expect(mocks.prisma.notificationJob.createMany).toHaveBeenCalled()
  })
})

describe('enqueueNotification (событийные, post_workout)', () => {
  it('queue=off → false (вызывающий уходит в legacy)', async () => {
    vi.stubEnv('NOTIFICATION_QUEUE', 'off')
    expect(await enqueueNotification({ type: 'post_workout', user: tgUser(), periodKey: 'w-1' })).toBe(false)
  })

  it('TG-юзер → job с каналом telegram и payload', async () => {
    const ok = await enqueueNotification({
      type: 'post_workout',
      user: { id: 'u1', telegramId: 42n, timezone: null },
      periodKey: 'workout-1',
      payload: { workoutId: 'workout-1' },
    })
    expect(ok).toBe(true)
    const arg = mocks.prisma.notificationJob.createMany.mock.calls[0][0]
    expect(arg.data[0]).toMatchObject({
      type: 'post_workout',
      channel: 'telegram',
      periodKey: 'workout-1',
      payload: { workoutId: 'workout-1' },
    })
    expect(arg.skipDuplicates).toBe(true)
  })

  it('web-only юзер: канал по подпискам из БД', async () => {
    mocks.prisma.pushSubscription.count.mockResolvedValue(2)
    const ok = await enqueueNotification({
      type: 'post_workout',
      user: { id: 'w1', telegramId: null },
      periodKey: 'workout-2',
    })
    expect(ok).toBe(true)
    expect(mocks.prisma.notificationJob.createMany.mock.calls[0][0].data[0].channel).toBe('web_push')
  })

  it('нет ни одного канала → false', async () => {
    mocks.prisma.pushSubscription.count.mockResolvedValue(0)
    expect(
      await enqueueNotification({ type: 'post_workout', user: { id: 'x', telegramId: null }, periodKey: 'k' }),
    ).toBe(false)
  })

  it('дубль (skipDuplicates съел) → false', async () => {
    mocks.prisma.notificationJob.createMany.mockResolvedValue({ count: 0 })
    expect(
      await enqueueNotification({ type: 'post_workout', user: tgUser(), periodKey: 'same' }),
    ).toBe(false)
  })
})
