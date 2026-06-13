/**
 * usageReport — сводка расхода токенов LLM с денежной оценкой (команда /cost).
 *
 * Числа берём из таблицы LlmUsage (пишет utils/llmUsage.js на каждый llm.chat/vision).
 * costUsd — снимок по прайсу на момент вызова (см. utils/llmCost.js), поэтому суммируем
 * сохранённые значения, а не пересчитываем по текущему прайсу.
 *
 * Отчёт глобальный (по всем юзерам): итоги за сегодня / 7 дн / 30 дн + разбивка по фичам за 30 дн.
 */
import prisma from '../../utils/prisma.js'

// Человекочитаемые названия фич для разбивки.
const FEATURE_LABELS = {
  chat: 'Чат',
  program_generate: 'Генерация программ',
  program_import: 'Импорт программ',
  vision_machine: 'Распознавание по фото',
  post_workout: 'Сводка после тренировки',
  weekly_summary: 'Недельная сводка',
  daily_insight: 'Дневной инсайт',
}

function startOfDaysAgo(days) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

/** Итоги (count, tokens, costUsd) за период от since. */
async function totalsSince(since) {
  const agg = await prisma.llmUsage.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { tokensInput: true, tokensOutput: true, costUsd: true },
    _count: { _all: true },
  })
  return {
    calls: agg._count._all,
    tokensInput: agg._sum.tokensInput ?? 0,
    tokensOutput: agg._sum.tokensOutput ?? 0,
    costUsd: agg._sum.costUsd ?? 0,
  }
}

/**
 * Собрать данные отчёта: итоги за сегодня / 7д / 30д + разбивка по фичам за 30д.
 * @returns {Promise<{ today, week, month, byFeature: Array }>}
 */
export async function getUsageReport() {
  const since1 = startOfDaysAgo(0)
  const since7 = startOfDaysAgo(7)
  const since30 = startOfDaysAgo(30)

  const [today, week, month, byFeatureRaw] = await Promise.all([
    totalsSince(since1),
    totalsSince(since7),
    totalsSince(since30),
    prisma.llmUsage.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: since30 } },
      _sum: { costUsd: true, tokensInput: true, tokensOutput: true },
      _count: { _all: true },
    }),
  ])

  const byFeature = byFeatureRaw
    .map((r) => ({
      feature: r.feature,
      calls: r._count._all,
      tokensInput: r._sum.tokensInput ?? 0,
      tokensOutput: r._sum.tokensOutput ?? 0,
      costUsd: r._sum.costUsd ?? 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd)

  return { today, week, month, byFeature }
}

// ─── Форматирование (HTML для Telegram) ─────────────────────────────

function fmtUsd(usd) {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function fmtTok(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtTotalsLine(label, t) {
  const tok = fmtTok(t.tokensInput + t.tokensOutput)
  return `${label}: <b>${fmtUsd(t.costUsd)}</b> · ${t.calls} вызов. · ${tok} ток.`
}

/**
 * Собрать HTML-сообщение для бота из данных отчёта.
 * @param {Awaited<ReturnType<typeof getUsageReport>>} report
 */
export function formatUsageReport(report) {
  const lines = ['💸 <b>Расход LLM</b> (все юзеры)', '']
  lines.push(fmtTotalsLine('Сегодня', report.today))
  lines.push(fmtTotalsLine('7 дней', report.week))
  lines.push(fmtTotalsLine('30 дней', report.month))

  if (report.byFeature.length) {
    lines.push('', '<b>По фичам (30 дн):</b>')
    for (const f of report.byFeature) {
      const label = FEATURE_LABELS[f.feature] || f.feature
      lines.push(`• ${label}: ${fmtUsd(f.costUsd)} (${f.calls})`)
    }
  }

  lines.push('', '<i>Оценка по прайсу на момент вызова, ≈</i>')
  return lines.join('\n')
}

/** Удобный шорткат: собрать и отформатировать отчёт за один вызов. */
export async function buildUsageReportHtml() {
  const report = await getUsageReport()
  return formatUsageReport(report)
}

export default { getUsageReport, formatUsageReport, buildUsageReportHtml }
