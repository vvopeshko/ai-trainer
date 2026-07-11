import { describe, it, expect, vi } from 'vitest'

import { runRetention, RETENTION } from './retention.js'

// Мок prisma: каждый deleteMany запоминает переданный where и возвращает count.
function makeDb() {
  return {
    analyticsEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    llmUsage: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    notificationLog: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    pendingChatContext: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    notificationJob: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
  }
}

const DAY_MS = 86_400_000

describe('runRetention', () => {
  it('удаляет по порогам createdAt/sentAt и возвращает счётчики', async () => {
    const now = new Date('2026-07-11T12:00:00Z')
    const db = makeDb()

    const res = await runRetention(now, db)

    expect(res).toEqual({
      analytics: 1,
      llmUsage: 2,
      notificationLog: 3,
      pendingContext: 4,
      notificationJobs: 5,
    })

    const cutoff = (days) => new Date(now.getTime() - days * DAY_MS)

    expect(db.analyticsEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cutoff(RETENTION.analyticsDays) } },
    })
    expect(db.llmUsage.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cutoff(RETENTION.llmUsageDays) } },
    })
    expect(db.notificationLog.deleteMany).toHaveBeenCalledWith({
      where: { sentAt: { lt: cutoff(RETENTION.notificationLogDays) } },
    })
    // Jobs очереди: только терминальные статусы, pending/retry живут до доставки
    expect(db.notificationJob.deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['sent', 'skipped', 'failed'] },
        updatedAt: { lt: cutoff(RETENTION.notificationJobDays) },
      },
    })
  })

  it('чистит только consumed PendingChatContext (consumedAt not null)', async () => {
    const now = new Date('2026-07-11T12:00:00Z')
    const db = makeDb()

    await runRetention(now, db)

    const arg = db.pendingChatContext.deleteMany.mock.calls[0][0]
    expect(arg.where.consumedAt.not).toBeNull()
    expect(arg.where.consumedAt.lt).toEqual(
      new Date(now.getTime() - RETENTION.pendingContextDays * DAY_MS),
    )
  })

  it('НЕ трогает ChatMessage (нет такого вызова)', async () => {
    const db = makeDb()
    db.chatMessage = { deleteMany: vi.fn() }

    await runRetention(new Date(), db)

    expect(db.chatMessage.deleteMany).not.toHaveBeenCalled()
  })
})
