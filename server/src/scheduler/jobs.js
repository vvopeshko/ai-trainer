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
  registerJob(weeklySummaryJob) // фаза 3.1 — еженедельная сводка (вс, 19:00)
  registerJob(reminderJob) // фаза 3.2 — напоминание «Готов вернуться?» (12:00)
}
