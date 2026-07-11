/**
 * notificationService — минутный cron durable-очереди (planner + worker).
 *
 * Запускается из index.js НЕЗАВИСИМО от бота: web push должен работать и без
 * BOT_TOKEN / при BOT_DISABLED. Внутри одного процесса тики защищены флагом —
 * если предыдущий ещё работает, новый не стартует параллельно.
 *
 * Флаги: NOTIFICATION_QUEUE=off|shadow|on (планирование),
 *        NOTIFICATION_WORKER=on|off (доставка, для аварийной паузы).
 */
import cron from 'node-cron'
import { planTick, queueMode } from './notificationPlanner.js'
import { workTick, workerEnabled } from './notificationWorker.js'

let task = null
let tickRunning = false

export async function notificationTick(now = new Date()) {
  if (tickRunning) return
  tickRunning = true
  try {
    await planTick(now)
    if (queueMode() === 'on') await workTick(now)
  } catch (err) {
    console.error('[notifications] tick failed:', err.message)
  } finally {
    tickRunning = false
  }
}

export function startNotificationService() {
  const mode = queueMode()
  if (mode === 'off') {
    console.log('[notifications] queue=off — durable-очередь выключена (legacy-шедулер активен)')
    return
  }
  if (task) return
  task = cron.schedule('* * * * *', () => notificationTick())
  console.log(`[notifications] started (queue=${mode}, worker=${workerEnabled() ? 'on' : 'off'})`)
}

export function stopNotificationService() {
  if (task) {
    task.stop()
    task = null
  }
}
