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

      // ─── Построение mockProgram из реальных данных ─────────────────
      function buildMockProgram() {{
        const all = WORKOUTS_DATA.workouts
        // Текущая программа = PPL+Arms (последняя активная)
        const ppl = all.filter((w) => w.programSlug === 'push-pull-legs-arms')
        if (!ppl.length) throw new Error('Нет данных по программе PPL+Arms')

        const lastDone = ppl[ppl.length - 1]
        const today = lastDone.date // симулируем "сегодня" = день после последней тренировки

        // Ротация 4-дневного сплита
        const rotation = ['.1 Chest Triceps', '.2 Back Biceps', '.3 Legs', '.4 Shoulders Arms']
        const lastIdx = rotation.findIndex((r) => lastDone.name.startsWith(r))
        const nextIdx = (lastIdx + 1) % rotation.length
        const nextKey = rotation[nextIdx]

        // Шаблон = последняя такая же тренировка
        const template = [...ppl].reverse().find((w) => w.name.startsWith(nextKey))
        if (!template) throw new Error(`Нет истории для ${{nextKey}}`)

        // Упражнения шаблона с метаданными.
        // Фильтруем подходы с reps=0 (это нестандартные заметки вроде "дропсеты").
        const exercises = template.exercises
          .map((ex) => {{
            const validSets = ex.sets.filter((s) => (s.reps || 0) > 0)
            if (!validSets.length) return null // пропускаем упражнения без валидных подходов
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
            }}
          }})
          .filter(Boolean)

        // Отображаемые имена
        const dayMeta = {{
          '.1 Chest Triceps': {{ name: 'День 1 · Грудь, трицепс', subtitle: 'Грудь + трицепс', type: '1' }},
          '.2 Back Biceps': {{ name: 'День 2 · Спина, бицепс', subtitle: 'Спина + бицепс', type: '2' }},
          '.3 Legs': {{ name: 'День 3 · Ноги', subtitle: 'Квадрицепс, бицепс бедра, ягодицы', type: '3' }},
          '.4 Shoulders Arms': {{ name: 'День 4 · Плечи, руки', subtitle: 'Плечи + бицепс + трицепс', type: '4' }},
        }}[nextKey]

        const duration = Math.max(40, Math.min(75, exercises.length * 6 + 18))

        // Прогресс в текущем цикле: считаем последние 30 дней
        const thirtyDaysAgo = new Date(today + 'T00:00:00Z')
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
        const cycleStartIso = thirtyDaysAgo.toISOString().slice(0, 10)
        const completedInCycle = ppl.filter((w) => w.date >= cycleStartIso).length
        const totalInCycle = 12 // плановые 12 тренировок в месяц (3/нед)

        // Последние 4 тренировки
        const recent = ppl.slice(-4).reverse().map((w) => {{
          const key = rotation.find((r) => w.name.startsWith(r)) || rotation[0]
          const meta = {{
            '.1 Chest Triceps': '1', '.2 Back Biceps': '2',
            '.3 Legs': '3', '.4 Shoulders Arms': '4',
          }}[key]
          return {{ label: _humanDate(w.date, today), type: meta }}
        }})

        return {{
          name: 'PPL + Arms',
          week: Math.ceil(ppl.length / 4),
          totalWorkouts: totalInCycle,
          completedWorkouts: Math.min(completedInCycle, totalInCycle),
          nextWorkout: {{
            type: dayMeta.type,
            name: dayMeta.name,
            subtitle: dayMeta.subtitle,
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
