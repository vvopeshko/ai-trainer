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

        // Все 4 дня программы: для экрана редактирования.
        // Берём последний шаблон каждого дня из истории.
        const programDays = rotation
          .map((key) => {{
            const tpl = [...ppl].reverse().find((w) => w.name.startsWith(key))
            if (!tpl) return null
            const exs = tpl.exercises
              .map((ex) => {{
                const valid = ex.sets.filter((s) => (s.reps || 0) > 0)
                if (!valid.length) return null
                const meta = _getMeta(ex.id)
                return {{
                  id: ex.id,
                  name: ex.name,
                  sets: valid.length,
                  targetReps: _derivTargetReps(valid),
                  muscles: meta.muscles,
                  bodyweight: ex.bodyweight,
                }}
              }})
              .filter(Boolean)
            return {{
              key,
              type: dayMeta[key].type,
              name: dayMeta[key].name,
              subtitle: dayMeta[key].subtitle,
              duration: Math.max(40, Math.min(75, exs.length * 6 + 18)),
              exercises: exs,
            }}
          }})
          .filter(Boolean)

        return {{
          name: 'PPL + Arms',
          goal: 'Набор массы',
          week: programWeek,
          totalWorkouts: totalInCycle,
          completedWorkouts: Math.min(completedInCycle, totalInCycle),
          // Описание программы для home-блока + экрана редактирования
          description: {{
            split: 'Push / Pull / Legs / Arms',
            daysPerWeek,
            difficulty: 'Средний',
            avgExercisesPerDay,
            focus: 'Гипертрофия с акцентом на грудь, спину и плечи. Чередуем верх и низ, на 4-й день — изоляция плеч и рук.',
          }},
          // Все 4 дня программы — список для экрана редактирования
          days: programDays,
          // Годовая статистика для шапки
          yearStats: (() => {{
            const year = todayDate.getUTCFullYear()
            const yearStartIso = `${{year}}-01-01`
            const done = all.filter((w) => w.date >= yearStartIso).length
            // Цель = daysPerWeek × 52 недели
            const target = daysPerWeek * 52
            return {{ year, done, target }}
          }})(),
          // Профиль (моковый, в проде придёт от Telegram + UserProfile)
          profile: {{
            firstName: 'Виктор',
            lastName: 'В.',
            initials: 'В',
            photoUrl: null,
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

      // ─── Таксономия мышц (детальная, с подмышцами) ────────────────
      // Каждая крупная зона разбита на конкретные мышцы со своими целями.
      // Цифры — недельные подходы для гипертрофии.
      // В реальном приложении будем считать с весом primary/secondary;
      // для прототипа — primary only (одно упражнение → одна подмышца).
      const MUSCLE_TAXONOMY = {{
        chest: {{
          label: 'Грудь',
          emoji: '🛡',
          targetTotal: [12, 18],
          subMuscles: {{
            upper: {{ label: 'Верх груди', target: [4, 8] }},
            mid: {{ label: 'Середина груди', target: [4, 8] }},
            lower: {{ label: 'Низ груди', target: [2, 6] }},
          }},
        }},
        back: {{
          label: 'Спина',
          emoji: '🦅',
          targetTotal: [12, 22],
          subMuscles: {{
            lats: {{ label: 'Широчайшие', target: [6, 12] }},
            mid: {{ label: 'Ромбовидные / середина', target: [4, 10] }},
            traps: {{ label: 'Трапеции', target: [2, 6] }},
            lower: {{ label: 'Низ спины (разгибатели)', target: [2, 4] }},
          }},
        }},
        shoulders: {{
          label: 'Плечи',
          emoji: '🪖',
          targetTotal: [12, 22],
          subMuscles: {{
            front: {{ label: 'Передние дельты', target: [4, 8] }},
            side: {{ label: 'Средние дельты', target: [6, 10] }},
            rear: {{ label: 'Задние дельты', target: [4, 10] }},
          }},
        }},
        arms: {{
          label: 'Руки',
          emoji: '💪',
          targetTotal: [12, 24],
          subMuscles: {{
            biceps: {{ label: 'Бицепс', target: [6, 12] }},
            triceps: {{ label: 'Трицепс', target: [6, 12] }},
            forearms: {{ label: 'Предплечья', target: [2, 6] }},
          }},
        }},
        legs: {{
          label: 'Ноги',
          emoji: '🦵',
          targetTotal: [12, 22],
          subMuscles: {{
            quads: {{ label: 'Квадрицепс', target: [6, 12] }},
            hamstrings: {{ label: 'Бицепс бедра', target: [4, 10] }},
            glutes: {{ label: 'Ягодицы', target: [4, 8] }},
            calves: {{ label: 'Икры', target: [2, 6] }},
            adductors: {{ label: 'Приводящие', target: [0, 4] }},
          }},
        }},
        core: {{
          label: 'Кор',
          emoji: '🔥',
          targetTotal: [6, 14],
          subMuscles: {{
            abs: {{ label: 'Пресс (прямая)', target: [4, 10] }},
            obliques: {{ label: 'Косые', target: [0, 4] }},
          }},
        }},
      }}

      // Маппинг упражнения → 'group.subMuscle'
      const MUSCLE_MAP = {{
        // Грудь
        'machine-chest-press': 'chest.mid',
        'smith-machine-incline-bench-press': 'chest.upper',
        'machine-incline-press': 'chest.upper',
        'bench-press-db': 'chest.mid',
        'machine-chest-fly': 'chest.mid',
        'pec-fly': 'chest.mid',
        'standing-cable-crossover': 'chest.mid',
        'dip': 'chest.lower',
        // Спина
        'pull-up': 'back.lats',
        'chin-up': 'back.lats',
        'lat-pulldown-narrow': 'back.lats',
        'lat-pulldown-wide': 'back.lats',
        'straight-arm-pulldown': 'back.lats',
        'seated-row': 'back.mid',
        'seated-row-wide': 'back.mid',
        'incline-row-db': 'back.mid',
        'row-single-arm-l-db': 'back.lats',
        'row-single-arm-r-db': 'back.lats',
        // Плечи
        'lateral-raise-machine': 'shoulders.side',
        'lateral-raise-db': 'shoulders.side',
        'reverse-fly-db': 'shoulders.rear',
        'machine-shoulder-fly': 'shoulders.rear',
        'cable-face-pull': 'shoulders.rear',
        'upright-row-cable': 'shoulders.side',
        'shoulder-press-machine': 'shoulders.front',
        // Руки
        'biceps-curl-cable': 'arms.biceps',
        'biceps-curl-db': 'arms.biceps',
        'hammer-curl-db': 'arms.biceps',
        'preacher-curl': 'arms.biceps',
        'reverse-curl-barbell': 'arms.forearms',
        'triceps-extension-rope': 'arms.triceps',
        'triceps-pulldown-rope': 'arms.triceps',
        // Ноги
        'leg-press': 'legs.quads',
        'seated-leg-extension': 'legs.quads',
        'prone-leg-curl': 'legs.hamstrings',
        'box-jump': 'legs.quads',
        'rfess-l-db': 'legs.quads',
        'rfess-r-db': 'legs.quads',
        'adductor-machine': 'legs.adductors',
        'abductor-machine': 'legs.glutes',
        'hip-thrust': 'legs.glutes',
        'calf-raise': 'legs.calves',
        // Кор
        'crunches': 'core.abs',
        'hanging-leg-raises': 'core.abs',
        'plank': 'core.abs',
      }}

      // ─── Данные для экрана "Прогресс" ──────────────────────────────
      // Actionable-метрики: соответствие плану, объём по мышцам vs цель,
      // плато/прогресс по упражнениям, дисбалансы, рекорды.
      function buildMockProgress() {{
        const all = WORKOUTS_DATA.workouts
        const ppl = all.filter((w) => w.programSlug === 'push-pull-legs-arms')
        if (!ppl.length) return null

        const lastDate = ppl[ppl.length - 1].date
        const todayDate = new Date(lastDate + 'T00:00:00Z')
        todayDate.setUTCDate(todayDate.getUTCDate() + 1)

        const dateOffset = (days) => {{
          const d = new Date(todayDate)
          d.setUTCDate(d.getUTCDate() - days)
          return d.toISOString().slice(0, 10)
        }}

        // ─── 1. Адаптация плана ───────────────────────────────
        const weekStart = dateOffset(7)
        const weekWorkouts = ppl.filter((w) => w.date >= weekStart)
        const planned = mockProgram.description.daysPerWeek
        const planAdherence = {{
          planned,
          done: weekWorkouts.length,
          remainingDays: Math.max(0, planned - weekWorkouts.length),
          // дни недели, в которые тренировался (понедельник=1)
          // (для визуализации точек сделанных тренировок)
          completedDates: weekWorkouts.map((w) => w.date),
        }}

        // ─── 2. Объём по мышцам за последнюю неделю ─────────────
        // Считаем подходы на каждую подмышцу, потом агрегируем в группы.
        function _classify(sets, min, max) {{
          if (sets === 0 && max > 0) return 'none'
          if (sets < min) return 'low'
          if (sets <= max) return 'optimal'
          if (sets <= max + Math.max(2, Math.ceil(max * 0.3))) return 'over'
          return 'overload'
        }}
        function _hint(sets, min, max, status) {{
          if (status === 'none') return 'не тренировал'
          if (status === 'low') return `до цели ещё ${{min - sets}}`
          if (status === 'optimal') return 'в норме'
          if (status === 'over') return `выше цели на ${{sets - max}}`
          return `сильно выше цели на ${{sets - max}}`
        }}

        const subSets = {{}} // 'chest.upper' → N
        for (const w of weekWorkouts) {{
          for (const ex of w.exercises) {{
            const path = MUSCLE_MAP[ex.id]
            if (!path) continue
            const valid = ex.sets.filter((s) => (s.reps || 0) > 0)
            subSets[path] = (subSets[path] || 0) + valid.length
          }}
        }}

        const muscleGroups = Object.entries(MUSCLE_TAXONOMY).map(([groupKey, info]) => {{
          const subs = Object.entries(info.subMuscles).map(([subKey, subInfo]) => {{
            const sets = subSets[`${{groupKey}}.${{subKey}}`] || 0
            const [min, max] = subInfo.target
            const status = _classify(sets, min, max)
            return {{ key: subKey, label: subInfo.label, sets, min, max, status, hint: _hint(sets, min, max, status) }}
          }})
          const total = subs.reduce((s, x) => s + x.sets, 0)
          const [min, max] = info.targetTotal
          const status = _classify(total, min, max)
          return {{
            key: groupKey,
            label: info.label,
            emoji: info.emoji,
            total,
            min,
            max,
            status,
            hint: _hint(total, min, max, status),
            subs,
          }}
        }})

        // ─── 3. Прогрессивная перегрузка: insights ──────────────
        // Используем упрощённую версию _computeRecommendation, но
        // только для упражнений со значимой историей (>= 3 сессий за месяц).
        const monthStart = dateOffset(30)
        const monthWorkouts = ppl.filter((w) => w.date >= monthStart)
        const exFreq = new Map()
        for (const w of monthWorkouts) {{
          for (const ex of w.exercises) {{
            exFreq.set(ex.id, (exFreq.get(ex.id) || 0) + 1)
          }}
        }}
        const overloadInsights = {{ plateau: [], progress: [], regression: [] }}
        for (const [exId, freq] of exFreq) {{
          if (freq < 3) continue
          const rec = _computeRecommendation(exId, ppl)
          if (!rec) continue
          const ex = ppl.flatMap((w) => w.exercises).find((e) => e.id === exId)
          if (!ex) continue
          const item = {{ id: exId, name: ex.name, rec }}
          if (rec.tone === 'plateau') overloadInsights.plateau.push(item)
          else if (rec.tone === 'progress') overloadInsights.progress.push(item)
          else if (rec.tone === 'regression') overloadInsights.regression.push(item)
        }}
        // Сортируем плато по числу подряд тренировок (самые длинные сверху)
        overloadInsights.plateau.sort((a, b) => {{
          const at = parseInt(a.rec.title.match(/\\d+/)?.[0] || 0)
          const bt = parseInt(b.rec.title.match(/\\d+/)?.[0] || 0)
          return bt - at
        }})

        // ─── 4. Дисбалансы ───────────────────────────────────────
        // Считаем за месяц на уровне подмышц, потом агрегируем в группы и пары.
        const monthSubSets = {{}}
        for (const w of monthWorkouts) {{
          for (const ex of w.exercises) {{
            const path = MUSCLE_MAP[ex.id]
            if (!path) continue
            monthSubSets[path] = (monthSubSets[path] || 0) +
              ex.sets.filter((s) => (s.reps || 0) > 0).length
          }}
        }}
        const groupSum = (groupKey) =>
          Object.keys(MUSCLE_TAXONOMY[groupKey].subMuscles)
            .reduce((s, sk) => s + (monthSubSets[`${{groupKey}}.${{sk}}`] || 0), 0)
        const imbalances = []
        const chest = groupSum('chest')
        const back = groupSum('back')
        if (chest > 0 && back > 0) {{
          const ratio = chest / back
          if (ratio >= 1.4) {{
            imbalances.push({{
              tone: 'warn',
              title: 'Грудь перевешивает спину',
              body: `${{chest}} vs ${{back}} подходов / месяц (соотношение ${{ratio.toFixed(1)}}). Здоровый баланс ~1:1. Добавь день со спиной или вытащи 2–3 подхода грудных в пользу тяг.`,
            }})
          }} else if (ratio <= 0.7) {{
            imbalances.push({{
              tone: 'warn',
              title: 'Спина перевешивает грудь',
              body: `${{back}} vs ${{chest}} подходов / месяц. Баланс сместился, добавь жимовые движения.`,
            }})
          }}
        }}
        const biceps = monthSubSets['arms.biceps'] || 0
        const triceps = monthSubSets['arms.triceps'] || 0
        if (biceps > 0 && triceps > 0) {{
          const ratio = biceps / triceps
          if (ratio >= 1.5) {{
            imbalances.push({{
              tone: 'warn',
              title: 'Бицепс перевешивает трицепс',
              body: `${{biceps}} vs ${{triceps}} за месяц. Для здоровья локтевых суставов рекомендуется ~1:1.`,
            }})
          }} else if (ratio <= 0.6) {{
            imbalances.push({{
              tone: 'warn',
              title: 'Трицепс перевешивает бицепс',
              body: `${{triceps}} vs ${{biceps}} за месяц. Добавь упражнения на бицепс.`,
            }})
          }}
        }}

        // ─── 5. Рекорды (как было) ───────────────────────────────
        const records = []
        const cutoffRecent = dateOffset(30)
        const cutoffPrev = dateOffset(90)
        const exMaxRecent = new Map()
        const exMaxPrev = new Map()
        const exSessionsPrev = new Map()
        for (const w of ppl) {{
          const isRecent = w.date >= cutoffRecent
          const isPrev = !isRecent && w.date >= cutoffPrev
          if (!isRecent && !isPrev) continue
          for (const ex of w.exercises) {{
            if (isPrev) {{
              exSessionsPrev.set(ex.id, (exSessionsPrev.get(ex.id) || 0) + 1)
            }}
            for (const s of ex.sets) {{
              if (!s.weightKg) continue
              const tgt = isRecent ? exMaxRecent : exMaxPrev
              const cur = tgt.get(ex.id) || 0
              if (s.weightKg > cur) tgt.set(ex.id, s.weightKg)
            }}
          }}
        }}
        for (const [id, recent] of exMaxRecent) {{
          const prev = exMaxPrev.get(id) || 0
          const sessions = exSessionsPrev.get(id) || 0
          if (sessions < 3 || prev <= 0 || recent <= prev) continue
          const delta = recent - prev
          const pct = (delta / prev) * 100
          if (delta < 2.5 || pct > 30) continue
          const ex = ppl.flatMap((w) => w.exercises).find((e) => e.id === id)
          if (!ex) continue
          records.push({{ id, name: ex.name, prevWeight: prev, weight: recent, delta }})
        }}
        records.sort((a, b) => b.delta - a.delta)

        // ─── Дисбалансы между передней / задней дельтой ───
        // Передние и трицепс часто перерабатываются (жимы), задние дельты —
        // отстают. Здоровье плеч сильно про этот баланс.
        const frontDelts = monthSubSets['shoulders.front'] || 0
        const rearDelts = monthSubSets['shoulders.rear'] || 0
        if (frontDelts > 0 || rearDelts > 0) {{
          if (rearDelts < 4 && (chest + frontDelts) > rearDelts * 3) {{
            imbalances.push({{
              tone: 'warn',
              title: 'Задние дельты отстают',
              body: `${{rearDelts}} подх./мес против ${{frontDelts + chest}} жимовых на передние дельты и грудь. Добавь face pulls и обратные разводки — иначе через год ноющее плечо.`,
            }})
          }}
        }}

        return {{
          today: todayDate.toISOString().slice(0, 10),
          planAdherence,
          muscleGroups,
          overloadInsights,
          imbalances,
          records,
        }}
      }}

      const mockProgress = buildMockProgress()

      // ─── (УДАЛЕНО v0.3) Старая vanity-версия buildMockProgress ────
      // Раньше тут был блок с total tonnage / total workouts / линейными
      // графиками. Заменили на actionable-метрики (см. реализацию выше:
      // planAdherence, muscleVolume, overloadInsights, imbalances).
      function _legacyMockProgress_unused() {{
        return null
        const all = WORKOUTS_DATA.workouts
        const ppl = all.filter((w) => w.programSlug === 'push-pull-legs-arms')
        if (!ppl.length) return null

        const lastDate = ppl[ppl.length - 1].date
        const todayDate = new Date(lastDate + 'T00:00:00Z')
        todayDate.setUTCDate(todayDate.getUTCDate() + 1)

        const dateOffset = (days) => {{
          const d = new Date(todayDate)
          d.setUTCDate(d.getUTCDate() - days)
          return d.toISOString().slice(0, 10)
        }}

        const filterFrom = (sinceIso) => ppl.filter((w) => w.date >= sinceIso)

        function periodStats(list) {{
          const stats = _computeMonthlyStats(list)
          const uniqueDays = new Set(list.map((w) => w.date)).size
          return {{
            workouts: list.length,
            tonnageKg: stats.tonnage,
            sets: stats.sets,
            days: uniqueDays,
            avgPerWeek: list.length === 0 ? 0 : Math.round((list.length / Math.max(7, uniqueDays)) * 7 * 10) / 10,
          }}
        }}

        const periods = {{
          week: periodStats(filterFrom(dateOffset(7))),
          month: periodStats(filterFrom(dateOffset(30))),
          all: periodStats(ppl),
        }}

        // История тоннажа — последние 14 тренировок
        const tonnageHistory = ppl.slice(-14).map((w) => {{
          let tonnage = 0
          for (const ex of w.exercises) {{
            for (const s of ex.sets) {{
              if ((s.weightKg || 0) > 0 && (s.reps || 0) > 0) {{
                tonnage += s.weightKg * s.reps
              }}
            }}
          }}
          return {{
            date: w.date,
            name: w.name,
            tonnageKg: Math.round(tonnage),
            type: w.name.match(/\\.(\\d)/)?.[1] || '?',
          }}
        }})

        // Топ-упражнения по числу сессий за последний месяц
        const usage = new Map()
        const monthList = filterFrom(dateOffset(60))
        for (const w of monthList) {{
          for (const ex of w.exercises) {{
            const e = usage.get(ex.id) || {{
              id: ex.id,
              name: ex.name,
              bodyweight: ex.bodyweight,
              sessions: 0,
            }}
            e.sessions += 1
            usage.set(ex.id, e)
          }}
        }}
        const topIds = [...usage.values()]
          .filter((e) => !e.bodyweight && e.sessions >= 4) // силовые с историей
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 5)
          .map((e) => e.id)

        // Для каждого топ-упражнения — прогрессия за всё время
        const exerciseProgress = topIds.map((id) => {{
          const sessions = []
          for (const w of all) {{
            const ex = w.exercises.find((e) => e.id === id)
            if (!ex) continue
            const valid = ex.sets.filter((s) => (s.reps || 0) > 0)
            if (!valid.length) continue
            const maxW = ex.bodyweight ? 0 : Math.max(...valid.map((s) => s.weightKg || 0))
            const maxReps = Math.max(...valid.map((s) => s.reps))
            sessions.push({{ date: w.date, maxW, maxReps }})
          }}
          if (sessions.length < 2) return null
          const first = sessions[0]
          const last = sessions[sessions.length - 1]
          const ex0 = all.flatMap((w) => w.exercises).find((e) => e.id === id)
          const isBw = ex0?.bodyweight
          const fromVal = isBw ? first.maxReps : first.maxW
          const toVal = isBw ? last.maxReps : last.maxW
          const delta = toVal - fromVal
          const pct = fromVal > 0 ? Math.round((delta / fromVal) * 100) : 0
          return {{
            id,
            name: ex0.name,
            bodyweight: isBw,
            sessions: sessions.slice(-10), // последние 10 точек для графика
            from: fromVal,
            to: toVal,
            delta,
            pct,
          }}
        }}).filter(Boolean)

        // Рекорды: упражнения с заметным ростом в последние 30 дней.
        // Используем тот же фильтр что и _findRecentPR (≤30% роста, ≥3 сессий до).
        const records = []
        const cutoffRecent = dateOffset(30)
        const cutoffPrev = dateOffset(90)
        const exMaxRecent = new Map()
        const exMaxPrev = new Map()
        const exSessionsPrev = new Map()
        for (const w of ppl) {{
          const isRecent = w.date >= cutoffRecent
          const isPrev = !isRecent && w.date >= cutoffPrev
          if (!isRecent && !isPrev) continue
          for (const ex of w.exercises) {{
            if (isPrev) {{
              exSessionsPrev.set(ex.id, (exSessionsPrev.get(ex.id) || 0) + 1)
            }}
            for (const s of ex.sets) {{
              if (!s.weightKg) continue
              const tgt = isRecent ? exMaxRecent : exMaxPrev
              const cur = tgt.get(ex.id) || 0
              if (s.weightKg > cur) tgt.set(ex.id, s.weightKg)
            }}
          }}
        }}
        for (const [id, recent] of exMaxRecent) {{
          const prev = exMaxPrev.get(id) || 0
          const sessions = exSessionsPrev.get(id) || 0
          if (sessions < 3 || prev <= 0 || recent <= prev) continue
          const delta = recent - prev
          const pct = (delta / prev) * 100
          if (delta < 2.5 || pct > 30) continue
          const ex = ppl.flatMap((w) => w.exercises).find((e) => e.id === id)
          if (!ex) continue
          // Когда был достигнут recent max
          let achievedDate = lastDate
          for (const w of ppl) {{
            if (w.date < cutoffRecent) continue
            const wEx = w.exercises.find((e) => e.id === id)
            if (!wEx) continue
            const maxW = Math.max(...wEx.sets.map((s) => s.weightKg || 0))
            if (maxW >= recent) {{
              achievedDate = w.date
              break
            }}
          }}
          records.push({{ id, name: ex.name, prevWeight: prev, weight: recent, delta, date: achievedDate }})
        }}
        records.sort((a, b) => b.date.localeCompare(a.date))

        return {{ periods, tonnageHistory, exerciseProgress, records, today: todayDate.toISOString().slice(0, 10) }}
      }}

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
