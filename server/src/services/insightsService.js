/**
 * insightsService — детекция плато / регрессии / роста / дисбалансов (AI_TRAINER_PLAN фаза 4.1).
 *
 * Принцип «числа — кодом, не LLM» (§1): вся детекция здесь, чистым кодом. LLM позже
 * только упаковывает топ-факт в «замечание тренера» (фаза 4.2, insightsController).
 *
 * Потребители:
 *   - GET /api/v1/progress/insights — чипы + карточки на Progress (без LLM);
 *   - GET /api/v1/insights/today — топ-факт → LLM-замечание на Home (с кэшем);
 *   - buildUserContext({ insights: true }) — факты в контекст weekly/monthly-сводок.
 *
 * Выход getInsights() — массив структурированных фактов { type, severity, ... } +
 * counts по типам. severity — число (больше = важнее), факты отсортированы по убыванию.
 */
import prisma from '../utils/prisma.js'
import { getMuscleVolume } from './statsService.js'

// Окно анализа серии по упражнению: сколько последних тренировок учитываем.
const WINDOW = 4
// Минимум тренировок с упражнением, чтобы вообще судить о тренде.
const MIN_SESSIONS = 3
// Порог «равенства» весов (кг) — чтобы 50.0 и 50.0 считались одинаковыми.
const EPS = 0.01

// Пороги дисбалансов (соотношение рабочих сетов за неделю).
const IMBALANCE_THRESHOLDS = [
  { a: 'chest', b: 'back', label: 'грудь / спина', max: 1.5 },
  { a: 'front_delt', b: 'rear_delt', label: 'передние / задние дельты', max: 2.0, sub: true },
]

// ─── Серии по упражнениям (один SQL-проход) ─────────────────────────

/**
 * Топ рабочий вес и макс. повторы по каждой тренировке за последние 8 недель,
 * сгруппированные по упражнению (хронологически). Один запрос на всё.
 */
async function loadExerciseSeries(userId) {
  const rows = await prisma.$queryRaw`
    WITH working AS (
      SELECT
        ws."exerciseId" AS exercise_id,
        w.id AS workout_id,
        w."finishedAt" AS finished_at,
        MAX(ws."weightKg") AS top_weight,
        MAX(ws.reps) AS max_reps
      FROM "WorkoutSet" ws
      JOIN "Workout" w ON ws."workoutId" = w.id
      WHERE w."userId" = ${userId}
        AND w."finishedAt" IS NOT NULL
        AND w."finishedAt" >= NOW() - INTERVAL '8 weeks'
        AND ws."isWarmup" = false
        AND ws."weightKg" IS NOT NULL
        AND ws."weightKg" > 0
      GROUP BY ws."exerciseId", w.id, w."finishedAt"
    )
    SELECT
      working.exercise_id AS "exerciseId",
      e."nameRu" AS "nameRu",
      working.finished_at AS "finishedAt",
      working.top_weight::float AS "topWeight",
      working.max_reps AS "maxReps"
    FROM working
    JOIN "Exercise" e ON e.id = working.exercise_id
    ORDER BY working.exercise_id, working.finished_at ASC
  `

  // Группировка по упражнению в хронологические серии.
  const byExercise = new Map()
  for (const r of rows) {
    if (!byExercise.has(r.exerciseId)) {
      byExercise.set(r.exerciseId, { exerciseId: r.exerciseId, nameRu: r.nameRu, sessions: [] })
    }
    byExercise.get(r.exerciseId).sessions.push({
      topWeight: r.topWeight != null ? Math.round(r.topWeight * 10) / 10 : null,
      maxReps: r.maxReps ?? null,
    })
  }
  return [...byExercise.values()]
}

// ─── Классификация одной серии ──────────────────────────────────────

/**
 * Классифицировать упражнение по последним WINDOW тренировкам.
 * @returns {{type, severity, data}|null}
 */
function classifySeries(sessions) {
  if (sessions.length < MIN_SESSIONS) return null

  const recent = sessions.slice(-WINDOW)
  const weights = recent.map((s) => s.topWeight).filter((w) => w != null)
  if (weights.length < MIN_SESSIONS) return null

  const first = weights[0]
  const last = weights[weights.length - 1]
  const maxW = Math.max(...weights)
  const minW = Math.min(...weights)

  // Регрессия: 2+ снижения подряд в хвосте серии.
  let trailingDrops = 0
  for (let i = weights.length - 1; i > 0; i--) {
    if (weights[i] < weights[i - 1] - EPS) trailingDrops++
    else break
  }
  if (trailingDrops >= 2) {
    return {
      type: 'regression',
      severity: 100 + Math.round((maxW - last) * 10),
      data: { from: weights[weights.length - 1 - trailingDrops], to: last, drops: trailingDrops },
    }
  }

  // Плато: вес не растёт на протяжении всего окна (разброс в пределах EPS)
  // и повторы тоже не прибавляются.
  if (maxW - minW <= EPS) {
    const reps = recent.map((s) => s.maxReps).filter((r) => r != null)
    const repsGrew = reps.length >= 2 && reps[reps.length - 1] > reps[0]
    if (!repsGrew) {
      return {
        type: 'plateau',
        severity: 50 + weights.length, // дольше стоит — важнее
        data: { weightKg: last, sessions: weights.length },
      }
    }
  }

  // Рост: последний вес выше первого в окне.
  if (last > first + EPS) {
    return {
      type: 'growth',
      severity: 10 + Math.round((last - first) * 10),
      data: { from: first, to: last, deltaKg: Math.round((last - first) * 10) / 10 },
    }
  }

  return null
}

// ─── Тексты фактов (данные, не UI-chrome — строятся здесь как nameRu) ──

function describeFact(type, nameRu, data) {
  switch (type) {
    case 'regression':
      return {
        title: `${nameRu}: просадка`,
        detail: `Рабочий вес снижается ${data.drops} трен. подряд — ${data.from} → ${data.to} кг. Стоит проверить восстановление или сбросить на шаг.`,
      }
    case 'plateau':
      return {
        title: `${nameRu}: плато`,
        detail: `${data.sessions} тренировки на ${data.weightKg} кг без сдвига. Можно добавить повтор, подход или чуть веса.`,
      }
    case 'growth':
      return {
        title: `${nameRu}: растёт`,
        detail: `+${data.deltaKg} кг за последние тренировки (${data.from} → ${data.to} кг). Так держать.`,
      }
    default:
      return { title: nameRu, detail: '' }
  }
}

// ─── Дисбалансы из недельного объёма ────────────────────────────────

function detectImbalances(muscleVolume) {
  const facts = []

  // Группы (грудь/спина): setsActual на верхнем уровне.
  const byGroup = Object.fromEntries(muscleVolume.map((g) => [g.group, g]))
  // Sub-мышцы (дельты): собираем плоско.
  const bySub = {}
  for (const g of muscleVolume) {
    for (const s of g.subMuscles || []) bySub[s.muscle] = s.setsActual
  }

  for (const th of IMBALANCE_THRESHOLDS) {
    const aVal = th.sub ? bySub[th.a] : byGroup[th.a]?.setsActual
    const bVal = th.sub ? bySub[th.b] : byGroup[th.b]?.setsActual
    if (aVal == null || bVal == null) continue
    // Нужен хоть какой-то объём, чтобы судить (минимум 3 сета суммарно).
    if (aVal + bVal < 3) continue

    const lo = Math.min(aVal, bVal)
    const hi = Math.max(aVal, bVal)
    const ratio = lo === 0 ? Infinity : hi / lo
    if (ratio > th.max) {
      const moreA = aVal > bVal
      facts.push({
        type: 'imbalance',
        severity: 40 + Math.round((ratio === Infinity ? 5 : ratio) * 5),
        muscles: [th.a, th.b],
        data: { a: aVal, b: bVal, ratio: ratio === Infinity ? null : Math.round(ratio * 10) / 10 },
        title: `Перекос: ${th.label}`,
        detail: `За неделю ${aVal} vs ${bVal} подходов — ${moreA ? th.a : th.b} заметно перевешивает. Подровняй объём, чтобы не копить дисбаланс.`,
      })
    }
  }
  return facts
}

// ─── Публичный API ──────────────────────────────────────────────────

/**
 * Все инсайты юзера: факты (отсортированы по severity) + counts по типам.
 * @param {string} userId
 * @param {string} tz
 * @returns {Promise<{ facts: Array<object>, counts: { growth, plateau, regression, imbalance } }>}
 */
export async function getInsights(userId, tz) {
  const [series, muscleVolume] = await Promise.all([
    loadExerciseSeries(userId),
    getMuscleVolume(userId, tz),
  ])

  const facts = []

  for (const ex of series) {
    const cls = classifySeries(ex.sessions)
    if (!cls) continue
    const text = describeFact(cls.type, ex.nameRu, cls.data)
    facts.push({
      type: cls.type,
      severity: cls.severity,
      exerciseId: ex.exerciseId,
      exerciseNameRu: ex.nameRu,
      data: cls.data,
      ...text,
    })
  }

  facts.push(...detectImbalances(muscleVolume))

  facts.sort((a, b) => b.severity - a.severity)

  const counts = { growth: 0, plateau: 0, regression: 0, imbalance: 0 }
  for (const f of facts) counts[f.type] = (counts[f.type] || 0) + 1

  return { facts, counts }
}
