"""
Inline workouts.json в mockup_v1.html — заменяет синтетический mockProgram на
buildMockProgram() поверх реальных данных пользователя за 4 месяца.

Идемпотентный: можно запускать повторно после обновления workouts.json.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
JSON_PATH = SCRIPT_DIR / "workouts.json"
HTML_PATH = SCRIPT_DIR.parent / "mockup_v1.html"

# ─── Границы вставки ────────────────────────────────────────────
# Ищем блок между заголовком "МОК-ДАННЫЕ" и комментарием следующего раздела,
# и заменяем его целиком.
START_MARK = "      // МОК-ДАННЫЕ\n"
END_MARK = "      // ЭКРАН: ГЛАВНЫЙ \"ПРОГРАММА\"\n"


def build_block(data: dict) -> str:
    json_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"""      // МОК-ДАННЫЕ
      // Реальные тренировки за 4 месяца (2026-01-02 … 2026-04-23), 60 тренировок.
      // Источник: prototype/mock_data/workouts.json (собирается из xlsx скриптом _build.py).
      // Регенерация inline-блока: cd prototype/mock_data && python3 _inline.py
      // ═══════════════════════════════════════════════════════════════

      const WORKOUTS_DATA = {json_str}

      // Метаданные упражнений, которых нет в исходных данных (мышцы, время отдыха).
      // Добавляем по мере использования; неизвестные — получают дефолт.
      const EXERCISE_META = {{
        'machine-chest-press': {{ muscles: 'грудь, трицепс', restSec: 120 }},
        'smith-machine-incline-bench-press': {{ muscles: 'верх груди, плечи', restSec: 150 }},
        'bench-press-db': {{ muscles: 'грудь', restSec: 120 }},
        'machine-incline-press': {{ muscles: 'верх груди', restSec: 120 }},
        'machine-chest-fly': {{ muscles: 'грудь', restSec: 90 }},
        'pec-fly': {{ muscles: 'грудь', restSec: 90 }},
        'standing-cable-crossover': {{ muscles: 'грудь', restSec: 90 }},
        'dip': {{ muscles: 'грудь, трицепс', restSec: 120 }},
        'pull-up': {{ muscles: 'широчайшие, бицепс', restSec: 120 }},
        'chin-up': {{ muscles: 'широчайшие, бицепс', restSec: 120 }},
        'seated-row': {{ muscles: 'широчайшие, ромбовидные', restSec: 90 }},
        'seated-row-wide': {{ muscles: 'широчайшие, ромбовидные', restSec: 90 }},
        'lat-pulldown-wide': {{ muscles: 'широчайшие', restSec: 90 }},
        'lat-pulldown-narrow': {{ muscles: 'широчайшие', restSec: 90 }},
        'straight-arm-pulldown': {{ muscles: 'широчайшие', restSec: 60 }},
        'incline-row-db': {{ muscles: 'широчайшие, ромбовидные', restSec: 90 }},
        'row-single-arm-l-db': {{ muscles: 'широчайшие (слева)', restSec: 75 }},
        'row-single-arm-r-db': {{ muscles: 'широчайшие (справа)', restSec: 75 }},
        'cable-face-pull': {{ muscles: 'задние дельты, трапеции', restSec: 60 }},
        'reverse-fly-db': {{ muscles: 'задние дельты', restSec: 60 }},
        'lateral-raise-db': {{ muscles: 'средние дельты', restSec: 60 }},
        'lateral-raise-machine': {{ muscles: 'средние дельты', restSec: 60 }},
        'upright-row-cable': {{ muscles: 'плечи, трапеции', restSec: 75 }},
        'shoulder-press-machine': {{ muscles: 'плечи, трицепс', restSec: 120 }},
        'triceps-extension-rope': {{ muscles: 'трицепс', restSec: 60 }},
        'triceps-pulldown-rope': {{ muscles: 'трицепс', restSec: 60 }},
        'biceps-curl-db': {{ muscles: 'бицепс', restSec: 60 }},
        'biceps-curl-cable': {{ muscles: 'бицепс', restSec: 60 }},
        'hammer-curl-db': {{ muscles: 'бицепс, предплечье', restSec: 60 }},
        'reverse-curl-barbell': {{ muscles: 'предплечье, бицепс', restSec: 60 }},
        'preacher-curl': {{ muscles: 'бицепс', restSec: 60 }},
        'machine-shoulder-fly': {{ muscles: 'задние дельты', restSec: 60 }},
        'seated-leg-extension': {{ muscles: 'квадрицепс', restSec: 90 }},
        'prone-leg-curl': {{ muscles: 'бицепс бедра', restSec: 90 }},
        'leg-press': {{ muscles: 'квадрицепс, ягодицы', restSec: 180 }},
        'box-jump': {{ muscles: 'ноги, взрывная сила', restSec: 90 }},
        'rfess-l-db': {{ muscles: 'квадрицепс, ягодицы (слева)', restSec: 90 }},
        'rfess-r-db': {{ muscles: 'квадрицепс, ягодицы (справа)', restSec: 90 }},
        'adductor-machine': {{ muscles: 'приводящие бедра', restSec: 60 }},
        'abductor-machine': {{ muscles: 'отводящие бедра', restSec: 60 }},
        'hip-thrust': {{ muscles: 'ягодицы', restSec: 120 }},
        'calf-raise': {{ muscles: 'икры', restSec: 60 }},
        'crunches': {{ muscles: 'пресс', restSec: 45 }},
        'hanging-leg-raises': {{ muscles: 'пресс', restSec: 60 }},
        'plank': {{ muscles: 'кор', restSec: 60 }},
      }}

      function _getMeta(id) {{
        return EXERCISE_META[id] || {{ muscles: '—', restSec: 90 }}
      }}

      // Таблица заранее подготовленных альтернатив по упражнениям.
      // В реальном бэке это поле upcoming Program.exercises[i].alternatives[].
      // Сценарий: тренажёр занят / устал / хочется разнообразия — переключаешься
      // одним тапом на альтернативу, не дёргая AI.
      const ALT_SWAPS = {{
        'pull-up': ['lat-pulldown-narrow', 'lat-pulldown-wide'],
        'chin-up': ['lat-pulldown-narrow', 'pull-up'],
        'lat-pulldown-narrow': ['lat-pulldown-wide', 'pull-up', 'seated-row'],
        'lat-pulldown-wide': ['lat-pulldown-narrow', 'pull-up'],
        'seated-row': ['seated-row-wide', 'lat-pulldown-wide', 'incline-row-db'],
        'seated-row-wide': ['seated-row', 'lat-pulldown-wide', 'incline-row-db'],
        'incline-row-db': ['seated-row', 'row-single-arm-l-db'],
        'cable-face-pull': ['reverse-fly-db', 'machine-shoulder-fly'],
        'machine-chest-press': ['smith-machine-incline-bench-press', 'bench-press-db'],
        'smith-machine-incline-bench-press': ['machine-chest-press', 'bench-press-db', 'machine-incline-press'],
        'bench-press-db': ['machine-chest-press', 'smith-machine-incline-bench-press'],
        'machine-chest-fly': ['pec-fly', 'standing-cable-crossover'],
        'pec-fly': ['machine-chest-fly', 'standing-cable-crossover'],
        'dip': ['triceps-extension-rope', 'machine-chest-press'],
        'triceps-extension-rope': ['triceps-pulldown-rope', 'dip'],
        'triceps-pulldown-rope': ['triceps-extension-rope'],
        'lateral-raise-machine': ['lateral-raise-db'],
        'lateral-raise-db': ['lateral-raise-machine', 'upright-row-cable'],
        'reverse-fly-db': ['cable-face-pull', 'machine-shoulder-fly'],
        'machine-shoulder-fly': ['cable-face-pull', 'reverse-fly-db'],
        'biceps-curl-cable': ['biceps-curl-db', 'hammer-curl-db'],
        'biceps-curl-db': ['biceps-curl-cable', 'hammer-curl-db'],
        'hammer-curl-db': ['biceps-curl-db', 'reverse-curl-barbell'],
        'reverse-curl-barbell': ['hammer-curl-db', 'biceps-curl-db'],
        'leg-press': ['seated-leg-extension'],
        'seated-leg-extension': ['leg-press'],
        'prone-leg-curl': ['rfess-l-db'],
        'crunches': ['hanging-leg-raises'],
        'hanging-leg-raises': ['crunches'],
      }}

      // Рекомендация по упражнению: анализ последних 5 сессий
      // → определяем плато / прогресс / откат / стабильность.
      // В проде логика будет в LLM-сервисе с более тонким анализом
      // (RPE, объём, периодизация). Здесь — простая эвристика для прототипа.
      function _computeRecommendation(exId, allWorkouts) {{
        const sessions = []
        for (let i = allWorkouts.length - 1; i >= 0 && sessions.length < 5; i--) {{
          const ex = allWorkouts[i].exercises.find((e) => e.id === exId)
          if (!ex) continue
          const valid = ex.sets.filter((s) => (s.reps || 0) > 0)
          if (!valid.length) continue
          const weights = valid.map((s) => s.weightKg || 0)
          sessions.push({{
            date: allWorkouts[i].date,
            maxW: ex.bodyweight ? 0 : Math.max(...weights),
            maxReps: Math.max(...valid.map((s) => s.reps)),
            totalReps: valid.reduce((sum, s) => sum + s.reps, 0),
            isBw: ex.bodyweight,
            setCount: valid.length,
          }})
        }}

        const last = sessions[0]
        if (!last) {{
          return {{
            tone: 'newcomer',
            emoji: '🆕',
            title: 'Новое упражнение',
            body: 'Первая попытка — ориентируйся на ощущения, не гонись за весом.',
          }}
        }}
        const prev = sessions[1]

        // Bodyweight: оперируем повторами и общим объёмом
        if (last.isBw) {{
          if (!prev) {{
            return {{
              tone: 'baseline',
              emoji: '🎯',
              title: 'Стартовый ориентир',
              body: `В прошлый раз ${{last.setCount}} подх. на ${{last.totalReps}} повт. Стартуй с такого же темпа.`,
            }}
          }}
          if (last.totalReps > prev.totalReps) {{
            return {{
              tone: 'progress',
              emoji: '📈',
              title: `Прогресс +${{last.totalReps - prev.totalReps}} повт.`,
              body: `Сделал ${{last.totalReps}} vs ${{prev.totalReps}} в прошлый раз. Можно прибавить ещё 1–2 повтора в первом подходе.`,
            }}
          }}
          if (last.totalReps < prev.totalReps) {{
            return {{
              tone: 'regression',
              emoji: '↩️',
              title: 'Откат повторов',
              body: `${{last.totalReps}} vs ${{prev.totalReps}} раньше. Сегодня просто верни прошлый темп — без героики.`,
            }}
          }}
          return {{
            tone: 'maintain',
            emoji: '⚖️',
            title: 'Держишь стабильно',
            body: `${{last.totalReps}} повторов в сумме — твой рабочий объём. Если закроешь всё легко, добавь +1 повтор.`,
          }}
        }}

        // Силовые с весом
        if (!prev) {{
          return {{
            tone: 'baseline',
            emoji: '🎯',
            title: 'Стартовый ориентир',
            body: `В прошлый раз — ${{last.maxW}} кг × ${{last.maxReps}}. Повтори или чуть выше.`,
            suggestedWeight: last.maxW,
          }}
        }}

        if (last.maxW > prev.maxW) {{
          const d = (last.maxW - prev.maxW).toFixed(1).replace(/\\.0$/, '')
          return {{
            tone: 'progress',
            emoji: '📈',
            title: `Прогресс +${{d}} кг`,
            body: `Вырос с ${{prev.maxW}} до ${{last.maxW}} кг. Закрепи этот вес — не торопись прибавлять дальше.`,
            suggestedWeight: last.maxW,
          }}
        }}

        // Плато: сколько подряд сессий держится тот же вес
        let plateau = 1
        for (let i = 1; i < sessions.length; i++) {{
          if (sessions[i].maxW === last.maxW && !sessions[i].isBw) plateau += 1
          else break
        }}

        if (plateau >= 3) {{
          const nextW = parseFloat((last.maxW + 2.5).toFixed(1))
          const targetReps = Math.max(6, last.maxReps - 2)
          return {{
            tone: 'plateau',
            emoji: '⚡',
            title: `Плато ${{plateau}} тренировки`,
            body: `${{last.maxW}}×${{last.maxReps}} стоит ${{plateau}} раза подряд. Попробуй ${{nextW}} × ${{targetReps}} на первом подходе — пробьёт стенку.`,
            suggestedWeight: nextW,
            suggestedReps: targetReps,
          }}
        }}

        if (last.maxW < prev.maxW) {{
          return {{
            tone: 'regression',
            emoji: '↩️',
            title: 'Шаг назад',
            body: `${{prev.maxW}} → ${{last.maxW}} кг. Возможно, устал в прошлый раз. Стартуй с ${{last.maxW}} и слушай тело.`,
            suggestedWeight: last.maxW,
          }}
        }}

        return {{
          tone: 'maintain',
          emoji: '⚖️',
          title: 'Держишь стабильно',
          body: `${{last.maxW}}×${{last.maxReps}} — твой рабочий вес. Закроешь все подходы до верха диапазона — попробуй +1 повтор.`,
          suggestedWeight: last.maxW,
        }}
      }}

      // Для альтернативы строим карточку: имя, мышцы, последняя сессия.
      function _buildAlternatives(exId, allWorkouts) {{
        const altIds = ALT_SWAPS[exId] || []
        const result = []
        for (const altId of altIds) {{
          // Последнее использование альтернативы в истории
          let last = null
          for (let i = allWorkouts.length - 1; i >= 0; i--) {{
            const ex = allWorkouts[i].exercises.find((e) => e.id === altId)
            if (ex) {{
              last = {{ ex, date: allWorkouts[i].date }}
              break
            }}
          }}
          if (!last) continue
          const meta = _getMeta(altId)
          const validSets = last.ex.sets.filter((s) => (s.reps || 0) > 0)
          if (!validSets.length) continue // нет валидных подходов в истории
          result.push({{
            id: altId,
            name: last.ex.name,
            muscles: meta.muscles,
            bodyweight: last.ex.bodyweight,
            lastSets: validSets.map((s) => ({{ weight: s.weightKg || 0, reps: s.reps }})),
            lastUsed: last.date,
          }})
        }}
        return result
      }}

      function _derivTargetReps(sets) {{
        const reps = sets.map((s) => s.reps).filter((r) => r > 0)
        if (!reps.length) return '—'
        const min = Math.min(...reps)
        const max = Math.max(...reps)
        return min === max ? `${{min}}` : `${{min}}-${{max}}`
      }}

      function _humanDate(dateStr, todayStr) {{
        const d = new Date(dateStr + 'T00:00:00Z')
        const t = new Date(todayStr + 'T00:00:00Z')
        const diff = Math.round((t - d) / 86400000)
        if (diff === 0) return 'Сегодня'
        if (diff === 1) return 'Вчера'
        if (diff < 7) return `${{diff}} дн. назад`
        if (diff < 14) return 'Неделю назад'
        return d.toLocaleDateString('ru-RU', {{ day: 'numeric', month: 'short' }})
      }}

      function _daysBetween(a, b) {{
        return Math.round((b - a) / 86400000)
      }}

      function _computeStreak(workouts, todayDate) {{
        // Подряд сделанных тренировок без разрыва > 3 дней (с конца к началу).
        let streak = 0
        let prev = todayDate
        for (const w of [...workouts].reverse()) {{
          const wDate = new Date(w.date + 'T00:00:00Z')
          if (_daysBetween(wDate, prev) > 3) break
          streak += 1
          prev = wDate
        }}
        return streak
      }}

      function _computeMonthlyStats(workouts) {{
        let tonnage = 0
        let totalSets = 0
        for (const w of workouts) {{
          for (const ex of w.exercises) {{
            for (const s of ex.sets) {{
              if ((s.weightKg || 0) > 0 && (s.reps || 0) > 0) {{
                tonnage += s.weightKg * s.reps
                totalSets += 1
              }} else if ((s.reps || 0) > 0) {{
                totalSets += 1
              }}
            }}
          }}
        }}
        return {{ tonnage: Math.round(tonnage), sets: totalSets }}
      }}

      function _findRecentPR(workouts) {{
        // PR за последние 30 дней против предыдущих 30–90 дней.
        // Сравниваем не с all-time max, а с прошлым месяцем —
        // так не ловим артефакты смены тренажёра под тем же именем.
        if (!workouts.length) return null
        const todayDate = new Date(workouts[workouts.length - 1].date + 'T00:00:00Z')
        const cutoffRecent = new Date(todayDate)
        cutoffRecent.setUTCDate(todayDate.getUTCDate() - 30)
        const cutoffPrev = new Date(todayDate)
        cutoffPrev.setUTCDate(todayDate.getUTCDate() - 90)
        const cutoffRecentIso = cutoffRecent.toISOString().slice(0, 10)
        const cutoffPrevIso = cutoffPrev.toISOString().slice(0, 10)

        const exMaxRecent = new Map() // последние 30 дней
        const exMaxPrev = new Map() // 30-90 дней назад
        const exSessionsPrev = new Map()

        for (const w of workouts) {{
          const isRecent = w.date >= cutoffRecentIso
          const isPrev = !isRecent && w.date >= cutoffPrevIso
          if (!isRecent && !isPrev) continue
          for (const ex of w.exercises) {{
            if (isPrev) {{
              exSessionsPrev.set(ex.id, (exSessionsPrev.get(ex.id) || 0) + 1)
            }}
            for (const s of ex.sets) {{
              if (!s.weightKg) continue
              const target = isRecent ? exMaxRecent : exMaxPrev
              const cur = target.get(ex.id) || 0
              if (s.weightKg > cur) target.set(ex.id, s.weightKg)
            }}
          }}
        }}

        let best = null
        for (const [id, recent] of exMaxRecent) {{
          const prev = exMaxPrev.get(id) || 0
          const sessionsPrev = exSessionsPrev.get(id) || 0
          if (sessionsPrev < 3) continue // нужна устойчивая база
          if (prev <= 0) continue
          if (recent <= prev) continue
          const delta = recent - prev
          if (delta < 2.5) continue // незначительный прирост
          const growthPct = (delta / prev) * 100
          if (growthPct > 30) continue // подозрительно большой скачок (смена тренажёра?)
          const ex = workouts.flatMap((w) => w.exercises).find((e) => e.id === id)
          if (!ex) continue
          if (!best || delta > best.delta) {{
            best = {{ id, name: ex.name, weight: recent, prevWeight: prev, delta }}
          }}
        }}
        return best
      }}

      // ─── Построение mockProgram из реальных данных ─────────────────
      function buildMockProgram() {{
        const all = WORKOUTS_DATA.workouts
        const ppl = all.filter((w) => w.programSlug === 'push-pull-legs-arms')
        if (!ppl.length) throw new Error('Нет данных по программе PPL+Arms')

        const lastDone = ppl[ppl.length - 1]

        // "Сегодня" = день после последней тренировки.
        const todayDate = new Date(lastDone.date + 'T00:00:00Z')
        todayDate.setUTCDate(todayDate.getUTCDate() + 1)
        const today = todayDate.toISOString().slice(0, 10)

        const daysSinceLast = _daysBetween(
          new Date(lastDone.date + 'T00:00:00Z'),
          todayDate,
        )

        // Ротация 4-дневного сплита
        const rotation = ['.1 Chest Triceps', '.2 Back Biceps', '.3 Legs', '.4 Shoulders Arms']
        const dayMeta = {{
          '.1 Chest Triceps': {{ name: 'День 1 · Грудь, трицепс', subtitle: 'Грудь + трицепс + плечи', type: '1' }},
          '.2 Back Biceps': {{ name: 'День 2 · Спина, бицепс', subtitle: 'Спина + бицепс', type: '2' }},
          '.3 Legs': {{ name: 'День 3 · Ноги', subtitle: 'Квадрицепс, бицепс бедра, ягодицы', type: '3' }},
          '.4 Shoulders Arms': {{ name: 'День 4 · Плечи, руки', subtitle: 'Плечи + бицепс + трицепс', type: '4' }},
        }}
        const lastIdx = rotation.findIndex((r) => lastDone.name.startsWith(r))
        const nextIdx = (lastIdx + 1) % rotation.length
        const nextKey = rotation[nextIdx]
        const lastKey = rotation[lastIdx]

        // Шаблон = последняя такая же тренировка
        const template = [...ppl].reverse().find((w) => w.name.startsWith(nextKey))
        if (!template) throw new Error(`Нет истории для ${{nextKey}}`)

        // Упражнения шаблона с метаданными + альтернативами.
        // Фильтруем подходы с reps=0 (нестандартные заметки вроде "дропсеты").
        const exercises = template.exercises
          .map((ex) => {{
            const validSets = ex.sets.filter((s) => (s.reps || 0) > 0)
            if (!validSets.length) return null
            const meta = _getMeta(ex.id)
            return {{
              id: ex.id,
              name: ex.name,
              sets: validSets.length,
              targetReps: _derivTargetReps(validSets),
              restSec: meta.restSec,
              muscles: meta.muscles,
              prev: validSets.map((s) => ({{ weight: s.weightKg || 0, reps: s.reps }})),
              bodyweight: ex.bodyweight,
              alternatives: _buildAlternatives(ex.id, all),
              recommendation: _computeRecommendation(ex.id, all),
            }}
          }})
          .filter(Boolean)

        const duration = Math.max(40, Math.min(75, exercises.length * 6 + 18))

        // Прогресс в текущем цикле: считаем последние 30 дней
        const thirtyDaysAgo = new Date(todayDate)
        thirtyDaysAgo.setUTCDate(todayDate.getUTCDate() - 30)
        const cycleStartIso = thirtyDaysAgo.toISOString().slice(0, 10)
        const monthlyWorkouts = ppl.filter((w) => w.date >= cycleStartIso)
        const completedInCycle = monthlyWorkouts.length
        const totalInCycle = 12

        // Месячная статистика: тоннаж, подходы
        const monthly = _computeMonthlyStats(monthlyWorkouts)

        // Streak — подряд тренировок без разрыва > 3 дней
        const streak = _computeStreak(monthlyWorkouts, todayDate)

        // PR за месяц — самое значительное превышение веса
        const recentPR = _findRecentPR(ppl)

        // Неделя с начала программы (PPL стартовала со второго месяца)
        const programStart = new Date(ppl[0].date + 'T00:00:00Z')
        const programWeek = Math.ceil(_daysBetween(programStart, todayDate) / 7)

        // Последние 4 тренировки
        const typeOf = (name) => {{
          const k = rotation.find((r) => name.startsWith(r)) || rotation[0]
          return {{ '.1 Chest Triceps': '1', '.2 Back Biceps': '2',
                   '.3 Legs': '3', '.4 Shoulders Arms': '4' }}[k]
        }}
        const recent = ppl.slice(-4).reverse().map((w) => ({{
          label: _humanDate(w.date, today),
          type: typeOf(w.name),
        }}))

        // AI-инсайт (для прототипа выбираем 1 из набора по дню)
        // В проде — генерируется LLM-сервисом раз в день и кэшируется.
        const insightPool = [
          {{
            emoji: '⚖️',
            text: 'За последний месяц грудь получила в 1.5× больше подходов, чем спина. На следующей неделе попробуй сместить акцент.',
            cta: 'Сбалансировать',
          }},
          {{
            emoji: '📈',
            text: 'Жим лежа вырос с 60 до 81 кг за 4 месяца — можно поднять верхнюю границу повторов с 8 до 10.',
            cta: 'Обновить план',
          }},
          {{
            emoji: '💡',
            text: 'Между подходами на ноги ты часто прерываешь отдых на 30+ секунд раньше. Попробуй полные 3 минуты — повторы дойдут.',
            cta: 'Принято',
          }},
          {{
            emoji: '🎯',
            text: 'Streak 5 тренировок подряд — отличный темп. Не забывай про восстановление: один полный день отдыха раз в 5–7 дней.',
            cta: 'Понял',
          }},
        ]
        const insight = insightPool[
          (todayDate.getUTCDate() + todayDate.getUTCMonth()) % insightPool.length
        ]

        // Описание программы — для блока "Моя программа" на главном экране.
        // Дни/нед — оценка средней частоты тренировок за последний месяц.
        const daysPerWeek = monthlyWorkouts.length >= 12 ? 4 : monthlyWorkouts.length >= 8 ? 3 : 2
        const avgExercisesPerDay = Math.round(
          monthlyWorkouts.reduce((s, w) => s + w.exercises.length, 0) /
            Math.max(1, monthlyWorkouts.length),
        )

        return {{
          name: 'PPL + Arms',
          goal: 'Набор массы',
          week: programWeek,
          totalWorkouts: totalInCycle,
          completedWorkouts: Math.min(completedInCycle, totalInCycle),
          // Описание программы для home-блока
          description: {{
            split: 'Push / Pull / Legs / Arms',
            daysPerWeek,
            difficulty: 'Средний',
            avgExercisesPerDay,
          }},
          // Контекст для главного экрана
          today,
          daysSinceLast,
          lastDoneType: typeOf(lastDone.name),
          lastDoneSubtitle: dayMeta[lastKey]?.subtitle ?? '',
          monthly: {{
            tonnageKg: monthly.tonnage,
            totalSets: monthly.sets,
            streak,
            pr: recentPR,
          }},
          insight,
          nextWorkout: {{
            type: dayMeta[nextKey].type,
            name: dayMeta[nextKey].name,
            subtitle: dayMeta[nextKey].subtitle,
            duration,
            exercises,
          }},
          recent,
        }}
      }}

      const mockProgram = buildMockProgram()

      // ═══════════════════════════════════════════════════════════════
"""


def main():
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")

    if START_MARK not in html or END_MARK not in html:
        raise SystemExit("Не нашёл маркеры для замены в mockup_v1.html")

    start = html.index(START_MARK)
    end = html.index(END_MARK)
    new_block = build_block(data)
    new_html = html[:start] + new_block + html[end:]

    HTML_PATH.write_text(new_html, encoding="utf-8")

    old_size = len(html)
    new_size = len(new_html)
    print(f"OK → {HTML_PATH.name}")
    print(f"  Размер: {old_size/1024:.1f} KB → {new_size/1024:.1f} KB (+{(new_size-old_size)/1024:.1f} KB)")
    print(f"  Workouts: {data['meta']['workoutCount']}")
    print(f"  Период: {data['meta']['rangeStart']} → {data['meta']['rangeEnd']}")


if __name__ == "__main__":
    main()
