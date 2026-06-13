/**
 * buildUserContext — единый сборщик контекста юзера для LLM.
 *
 * Один источник «памяти тренера», который используют чат, пост-тренировочные сводки,
 * weekly/monthly-сводки и инсайты (AI_TRAINER_PLAN фаза 0.3). Разные потребители берут
 * разные подмножества через опции.
 *
 * Возвращает компактный markdown-текст для system-промпта (НЕ JSON-простыня — бережём
 * токены). Числа считает statsService (принцип «числа — кодом»).
 */
import prisma from '../../utils/prisma.js'
import {
  getMonthStats,
  getWeekStats,
  getRecords,
} from '../statsService.js'
import { getInsights } from '../insightsService.js'

const DEFAULT_TZ = 'Europe/Moscow'

const GOAL_RU = {
  weight_loss: 'похудение',
  muscle_gain: 'набор массы',
  strength: 'сила',
  tone: 'тонус',
  endurance: 'выносливость',
  general_fitness: 'общая форма',
}

const LEVEL_RU = {
  beginner: 'новичок',
  intermediate: 'средний',
  advanced: 'продвинутый',
}

/**
 * @param {string} userId
 * @param {object} [opts]
 * @param {boolean} [opts.profile=true]
 * @param {boolean} [opts.program=true]
 * @param {boolean} [opts.recentWorkouts=true]
 * @param {boolean} [opts.stats=true]
 * @param {boolean} [opts.records=true]
 * @param {boolean} [opts.insights=false] — блок детекции плато/регрессии/дисбалансов
 * @param {number}  [opts.recentLimit=7]
 * @returns {Promise<string>} markdown-блок для system-промпта (пустая строка если данных нет)
 */
export async function buildUserContext(userId, opts = {}) {
  const {
    profile = true,
    program = true,
    recentWorkouts = true,
    stats = true,
    records = true,
    insights = false,
    recentLimit = 7,
  } = opts

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, timezone: true },
  })
  if (!user) return ''

  const tz = user.timezone || DEFAULT_TZ
  const sections = []

  // ─── Профиль ───
  if (profile) {
    const p = await prisma.userProfile.findUnique({ where: { userId } })
    const lines = [`Имя: ${user.firstName}`]
    if (p) {
      lines.push(`Цель: ${GOAL_RU[p.goal] || p.goal}`)
      lines.push(`Уровень: ${LEVEL_RU[p.experienceLevel] || p.experienceLevel}`)
      if (p.age) lines.push(`Возраст: ${p.age}`)
      if (p.gender) lines.push(`Пол: ${p.gender === 'male' ? 'м' : p.gender === 'female' ? 'ж' : '—'}`)
      if (p.weightKg) lines.push(`Вес: ${p.weightKg} кг`)
      if (p.constraints?.length) lines.push(`Ограничения: ${p.constraints.join(', ')}`)
      if (p.equipment?.length) lines.push(`Оборудование: ${p.equipment.join(', ')}`)
      if (p.sessionsPerWeek) lines.push(`Тренировок в неделю (план): ${p.sessionsPerWeek}`)
    }
    sections.push(`## Профиль\n${lines.join('\n')}`)
  }

  // ─── Активная программа ───
  if (program) {
    const prog = await prisma.program.findFirst({
      where: { userId, isActive: true },
      select: { name: true, planJson: true, guidelines: true },
    })
    if (prog) {
      const days = prog.planJson?.days || []
      const dayLines = days.map((d, i) => {
        const exNames = (d.exercises || []).map((e) => e.nameRu).filter(Boolean)
        return `  ${i + 1}. ${d.title || `День ${i + 1}`}: ${exNames.join(', ') || '—'}`
      })
      const block = [`## Активная программа: ${prog.name}`, ...dayLines]
      if (prog.guidelines?.progression) {
        block.push(`Прогрессия: ${stringifyShort(prog.guidelines.progression)}`)
      }
      sections.push(block.join('\n'))
    } else {
      sections.push('## Активная программа\nНет — юзер тренируется без программы.')
    }
  }

  // ─── Статистика ───
  if (stats) {
    const [month, week] = await Promise.all([
      getMonthStats(userId, tz),
      getWeekStats(userId, tz),
    ])
    const statLines = [
      `Серия (streak): ${month.streak} дн.`,
      `Неделя: ${week.workouts} трен., тоннаж ${week.tonnageKg} кг (пред. неделя: ${week.prevWorkouts} трен., ${week.prevTonnageKg} кг)`,
      `Месяц: ${month.workouts} трен., тоннаж ${month.tonnageKg} кг (пред. месяц: ${month.prevWorkouts} трен., ${month.prevTonnageKg} кг)`,
    ]
    sections.push(`## Статистика\n${statLines.join('\n')}`)
  }

  // ─── Недавние тренировки ───
  if (recentWorkouts) {
    const workouts = await prisma.workout.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      take: recentLimit,
      select: {
        finishedAt: true,
        programDayIndex: true,
        feltRating: true,
        program: { select: { planJson: true } },
        sets: {
          where: { isWarmup: false },
          select: {
            weightKg: true,
            reps: true,
            exercise: { select: { nameRu: true } },
          },
        },
      },
    })

    if (workouts.length > 0) {
      const lines = workouts.map((w) => {
        const date = formatDate(w.finishedAt, tz)
        const dayTitle = w.program?.planJson?.days?.[w.programDayIndex]?.title
        // топ-вес по упражнениям (компактно: упр Nкг×R)
        const top = new Map()
        for (const s of w.sets) {
          const cur = top.get(s.exercise.nameRu)
          const w0 = s.weightKg || 0
          if (!cur || w0 > cur.weightKg) top.set(s.exercise.nameRu, { weightKg: w0, reps: s.reps })
        }
        const keyLifts = [...top.entries()]
          .slice(0, 4)
          .map(([name, v]) => (v.weightKg ? `${name} ${v.weightKg}×${v.reps}` : `${name} ${v.reps}`))
          .join('; ')
        const felt = w.feltRating ? ` (ощущения ${w.feltRating}/5)` : ''
        return `  • ${date}${dayTitle ? ` — ${dayTitle}` : ''}: ${keyLifts}${felt}`
      })
      sections.push(`## Недавние тренировки (${workouts.length})\n${lines.join('\n')}`)
    }
  }

  // ─── Рекорды месяца ───
  if (records) {
    const recs = await getRecords(userId, tz, 'month')
    if (recs.length > 0) {
      const lines = recs
        .slice(0, 5)
        .map((r) => `  🏆 ${r.exerciseNameRu}: ${r.value} кг × ${r.reps} (было ${r.previousBest} кг)`)
      sections.push(`## Рекорды за месяц\n${lines.join('\n')}`)
    }
  }

  // ─── Замечания тренера (детекция кодом) ───
  if (insights) {
    const { facts } = await getInsights(userId, tz)
    if (facts.length > 0) {
      const lines = facts.slice(0, 5).map((f) => `  • ${f.title} — ${f.detail}`)
      sections.push(`## Замечания (детекция)\n${lines.join('\n')}`)
    }
  }

  return sections.join('\n\n')
}

function formatDate(d, tz) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(d))
}

function stringifyShort(val) {
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val)
  } catch {
    return String(val)
  }
}
