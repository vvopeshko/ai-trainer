/**
 * jobs — регистрация проактивных джобов в шедулере.
 *
 * Один вызов registerJobs() из index.js перед startScheduler(). Держим список
 * джобов отдельно от scheduler/index.js (инфраструктура) — чтобы добавление
 * новой проактивной фичи трогало только этот файл.
 */
import { registerJob } from './index.js'
import { weeklySummaryJob } from '../services/aiTrainer/weeklySummary.js'
import { reminderJob } from '../services/aiTrainer/reminder.js'

export function registerJobs() {
  // weekly переехала в durable-очередь (notificationPlanner): при queue=on
  // legacy-ветка подавлена — иначе двойная отправка. off/shadow → legacy шлёт.
  if (process.env.NOTIFICATION_QUEUE !== 'on') {
    registerJob(weeklySummaryJob) // фаза 3.1 — еженедельная сводка (вс, 19:00)
  }
  registerJob(reminderJob) // фаза 3.2 — «Готов вернуться?» (12:00); telegram-only, вне очереди
}
