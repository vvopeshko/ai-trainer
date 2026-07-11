/**
 * notificationWorker — claim, render, delivery (этапы 2–3 очереди).
 *
 * Каждый минутный тик:
 *   1. восстанавливает протухшие locks (rendering/sending > 10 мин → retry);
 *   2. атомарно клеймит доступные jobs (optimistic CAS: updateMany с проверкой
 *      прочитанных status+lockedAt — из N конкурентных worker'ов побеждает один);
 *   3. рендерит, если renderedText ещё нет (LLM-текст сохраняется в job —
 *      retry доставки НЕ вызывает LLM повторно);
 *   4. доставляет в Telegram или Web Push и фиксирует результат.
 *
 * Мост идемпотентности с legacy: перед доставкой claimNotification()
 * (NotificationLog) — включение очереди не продублирует уже отправленное
 * legacy-шедулером, и наоборот.
 */
import crypto from 'node:crypto'
import prisma from '../utils/prisma.js'
import { retryDelayMs, classifyDeliveryError, truncateError } from './notificationCore.js'
import { claimNotification } from './index.js'
import { notify } from '../bot/notifier.js'
import { sendPushToUser } from '../services/webPushService.js'
import { renderWeeklySummary } from '../services/aiTrainer/weeklySummary.js'
import { renderPostWorkoutSummary } from '../services/aiTrainer/postWorkoutSummary.js'
import { track } from '../utils/analytics.js'

const LOCK_TTL_MS = 10 * 60_000
const WORKER_ID = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`

const BATCH_SIZE = clampInt(process.env.NOTIFICATION_BATCH_SIZE, 20, 1, 100)
const CONCURRENCY = clampInt(process.env.NOTIFICATION_CONCURRENCY, 5, 1, 10) // hard cap 10

function clampInt(raw, def, min, max) {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n)) return def
  return Math.min(Math.max(n, min), max)
}

export function workerEnabled() {
  return (process.env.NOTIFICATION_WORKER || 'on') !== 'off'
}

/** Один проход worker'а. @returns {Promise<{ claimed: number }>} */
export async function workTick(now = new Date()) {
  if (!workerEnabled()) return { claimed: 0 }

  await recoverStaleLocks(now)

  // Кандидаты: pending сразу, retry — по nextAttemptAt
  const candidates = await prisma.notificationJob.findMany({
    where: {
      status: { in: ['pending', 'retry'] },
      nextAttemptAt: { lte: now },
    },
    orderBy: { scheduledFor: 'asc' },
    take: BATCH_SIZE,
  })
  if (candidates.length === 0) return { claimed: 0 }

  // Атомарный claim: CAS по прочитанным status+lockedAt
  const claimed = []
  for (const job of candidates) {
    const res = await prisma.notificationJob.updateMany({
      where: { id: job.id, status: job.status, lockedAt: job.lockedAt },
      data: {
        status: 'rendering',
        lockedAt: now,
        lockedBy: WORKER_ID,
        attempts: { increment: 1 },
      },
    })
    if (res.count === 1) claimed.push({ ...job, attempts: job.attempts + 1 })
  }
  if (claimed.length === 0) return { claimed: 0 }
  console.log(`[notifications][worker] claimed=${claimed.length}`)

  // Параллельными группами не шире CONCURRENCY
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    await Promise.all(claimed.slice(i, i + CONCURRENCY).map((job) => processJob(job)))
  }
  return { claimed: claimed.length }
}

async function recoverStaleLocks(now) {
  const res = await prisma.notificationJob.updateMany({
    where: {
      status: { in: ['rendering', 'sending'] },
      lockedAt: { lt: new Date(now.getTime() - LOCK_TTL_MS) },
    },
    data: { status: 'retry', lockedAt: null, lockedBy: null, nextAttemptAt: now },
  })
  if (res.count > 0) console.log(`[notifications][worker] stale locks recovered=${res.count}`)
}

// ─── Обработка одного job ────────────────────────────────────────────

async function processJob(job) {
  try {
    const userId = job.recipientKey.startsWith('user:') ? job.recipientKey.slice(5) : null
    if (!userId) return skip(job, 'unknown_recipient')

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return fail(job, 'recipient_missing', 'user deleted', true)

    // 1. Render (если текст ещё не сохранён — retry доставки сюда не заходит)
    let payload = job.payload || {}
    let renderedText = job.renderedText
    if (!renderedText) {
      const rendered = await renderJob(job, user)
      if (rendered.skip) return skip(job, rendered.skip)
      renderedText = job.channel === 'telegram' ? rendered.html : rendered.pushBody
      payload = {
        ...payload,
        pushTitle: rendered.pushTitle,
        url: rendered.url,
        buttons: rendered.buttons ?? null,
        meta: rendered.meta ?? null,
      }
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { renderedText, payload, status: 'sending' },
      })
    } else {
      await prisma.notificationJob.update({ where: { id: job.id }, data: { status: 'sending' } })
    }

    // 2. Мост идемпотентности с legacy-шедулером (NotificationLog) — только
    // на ПЕРВОЙ попытке: false = legacy уже отправил этот период. На ретраях
    // клейм уже наш собственный (создан на попытке 1) — проверять нельзя,
    // иначе job навсегда скипается после первой же неудачной доставки.
    if (job.attempts <= 1) {
      const bridged = await claimNotification(userId, job.type, job.periodKey)
      if (!bridged) return skip(job, 'already_sent_legacy')
    }

    // 3. Delivery
    let providerRef = null
    try {
      if (job.channel === 'telegram') {
        if (!user.telegramId) return fail(job, 'tg_unlinked', 'telegram unlinked after planning', true)
        const sent = await notify(user.telegramId, renderedText, { buttons: payload.buttons || undefined })
        if (!sent) throw new Error('notify returned false (bot unavailable)')
        providerRef = 'tg:sent'
      } else if (job.channel === 'web_push') {
        const res = await sendPushToUser(userId, {
          title: payload.pushTitle || 'AI Trainer',
          body: renderedText,
          url: payload.url || '/',
          tag: `ait-${job.type}-${job.periodKey}`,
        })
        if (res.noSubscriptions) return fail(job, 'no_push_subscriptions', 'all subscriptions gone', true)
        if (res.sent === 0) throw res.lastError || new Error('push delivery failed')
        providerRef = `push:${res.sent}`
      } else {
        return skip(job, 'unknown_channel')
      }
    } catch (deliveryErr) {
      return handleError(job, deliveryErr)
    }

    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: 'sent', sentAt: new Date(), providerRef, lockedAt: null, lockedBy: null, errorCode: null, errorMessage: null },
    })
    track(userId, 'notification_sent', { type: job.type, channel: job.channel })
    console.log(`[notifications] job=${job.id} type=${job.type} channel=${job.channel} status=sent`)
  } catch (err) {
    // Ошибка рендера/БД — общий обработчик
    await handleError(job, err).catch((e) =>
      console.error('[notifications] job error handling failed', job.id, e.message),
    )
  }
}

async function renderJob(job, user) {
  switch (job.type) {
    case 'weekly':
      return renderWeeklySummary(user)
    case 'post_workout': {
      const p = job.payload || {}
      if (!p.workoutId) return { skip: 'missing_payload' }
      return renderPostWorkoutSummary(user, {
        id: p.workoutId,
        programId: p.programId ?? null,
        programDayIndex: p.programDayIndex ?? null,
      })
    }
    default:
      return { skip: 'unknown_type' }
  }
}

// ─── Терминальные переходы ──────────────────────────────────────────

async function skip(job, code) {
  await prisma.notificationJob.update({
    where: { id: job.id },
    data: { status: 'skipped', errorCode: code, lockedAt: null, lockedBy: null },
  })
  console.log(`[notifications] job=${job.id} type=${job.type} status=skipped code=${code}`)
}

async function fail(job, code, message, permanent = false) {
  await prisma.notificationJob.update({
    where: { id: job.id },
    data: {
      status: 'failed',
      errorCode: code,
      errorMessage: truncateError(message),
      lockedAt: null,
      lockedBy: null,
    },
  })
  console.error(`[notifications] job=${job.id} type=${job.type} status=failed code=${code}${permanent ? ' (permanent)' : ''}`)
}

async function handleError(job, err) {
  const { permanent, code, retryAfterMs } = classifyDeliveryError(err, job.channel)
  if (permanent || job.attempts >= job.maxAttempts) {
    return fail(job, code, err?.message, permanent)
  }
  const delay = retryAfterMs ?? retryDelayMs(job.attempts)
  await prisma.notificationJob.update({
    where: { id: job.id },
    data: {
      status: 'retry',
      nextAttemptAt: new Date(Date.now() + delay),
      errorCode: code,
      errorMessage: truncateError(err?.message),
      lockedAt: null,
      lockedBy: null,
    },
  })
  console.warn(`[notifications] job=${job.id} type=${job.type} status=retry code=${code} attempt=${job.attempts}/${job.maxAttempts}`)
}
