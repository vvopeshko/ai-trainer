/**
 * retention — суточная чистка технических таблиц от старых строк.
 *
 * Тех-логи (аналитика, учёт токенов LLM, лог проактивных рассылок, consumed
 * handoff-контекст) копятся вечно и раздувают БД без пользы для продукта.
 * ChatMessage НЕ трогаем — это история диалога, она ценна.
 *
 * Джоб глобальный (не per-user), поэтому регистрируется отдельным суточным cron
 * (startRetention), а не через per-user registerJob() из scheduler/index.js.
 * Идемпотентен: deleteMany по порогу времени — повторный запуск в тот же день
 * удалит 0 строк. Отключается переменной DISABLE_RETENTION=true.
 */
import cron from 'node-cron'
import prisma from '../utils/prisma.js'

const DAY_MS = 86_400_000

// Пороги хранения (дни). Аналитика и usage — 90 дней (хватает для месячных
// отчётов и /cost с запасом), notification log и consumed-контекст — 30.
export const RETENTION = {
  analyticsDays: 90,
  llmUsageDays: 90,
  notificationLogDays: 30,
  pendingContextDays: 30,
  // Терминальные jobs очереди уведомлений (sent/skipped/failed) — аудит на 60 дней
  notificationJobDays: 60,
}

let task = null

/**
 * Один проход чистки. Экспортируется для ручного вызова/теста.
 * @param {Date} [now]
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<{ analytics: number, llmUsage: number, notificationLog: number, pendingContext: number }>}
 */
export async function runRetention(now = new Date(), db = prisma) {
  const ts = now.getTime()
  const cutoff = (days) => new Date(ts - days * DAY_MS)

  const [analytics, llmUsage, notificationLog, pendingContext, notificationJobs] = await Promise.all([
    db.analyticsEvent.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION.analyticsDays) } },
    }),
    db.llmUsage.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION.llmUsageDays) } },
    }),
    db.notificationLog.deleteMany({
      where: { sentAt: { lt: cutoff(RETENTION.notificationLogDays) } },
    }),
    // Только consumed-контекст: не тронутый handoff может ещё ждать первого сообщения.
    db.pendingChatContext.deleteMany({
      where: { consumedAt: { not: null, lt: cutoff(RETENTION.pendingContextDays) } },
    }),
    // Только терминальные статусы: pending/retry живут до доставки
    db.notificationJob.deleteMany({
      where: {
        status: { in: ['sent', 'skipped', 'failed'] },
        updatedAt: { lt: cutoff(RETENTION.notificationJobDays) },
      },
    }),
  ])

  return {
    analytics: analytics.count,
    llmUsage: llmUsage.count,
    notificationLog: notificationLog.count,
    pendingContext: pendingContext.count,
    notificationJobs: notificationJobs.count,
  }
}

/** Запуск суточного cron чистки (04:00 по времени сервера). */
export function startRetention() {
  if (task) return
  if (process.env.DISABLE_RETENTION === 'true') {
    console.log('[retention] disabled via DISABLE_RETENTION')
    return
  }
  task = cron.schedule('0 4 * * *', () => {
    runRetention()
      .then((r) =>
        console.log(
          `[retention] cleaned analytics=${r.analytics} llmUsage=${r.llmUsage} ` +
            `notificationLog=${r.notificationLog} pendingContext=${r.pendingContext}`,
        ),
      )
      .catch((err) => console.error('[retention] run failed', err.message))
  })
  console.log('[retention] started (daily tick at 04:00)')
}

/** Остановка (graceful shutdown). */
export function stopRetention() {
  if (task) {
    task.stop()
    task = null
  }
}
