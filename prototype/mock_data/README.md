# Mock data — реальные тренировки

Исходник: `workouts_2026.xlsx` (4 месяца: январь–апрель 2026).
Результат: `workouts.json` — структурированные данные для использования в прототипе мини-аппа.

## Структура `workouts.json`

```json
{
  "workouts": [
    {
      "id": "w-20260102-1",
      "date": "2026-01-02",
      "name": "2 Chest Back Shoulders B",
      "programSlug": "jan-split",
      "programLabel": "Январь: 2-дневный сплит",
      "exercises": [
        {
          "id": "machine-chest-press",
          "name": "Machine Chest Press",
          "bodyweight": false,
          "sets": [
            { "reps": 10, "weightKg": 60 },
            { "reps": 10, "weightKg": 70 },
            { "reps": 5,  "weightKg": 70 }
          ]
        }
      ]
    }
  ],
  "exercises": [
    {
      "id": "machine-chest-press",
      "name": "Machine Chest Press",
      "bodyweight": false,
      "totalSessions": 20,
      "totalSets": 71,
      "maxWeightKg": 81,
      "firstUsed": "2026-01-02",
      "lastUsed": "2026-04-21"
    }
  ],
  "programs": [
    {
      "slug": "jan-split",
      "label": "Январь: 2-дневный сплит",
      "firstSeen": "2026-01-02",
      "lastSeen": "2026-01-30",
      "workoutNames": ["2 Chest Back Shoulders B", ...]
    }
  ],
  "stats": {
    "2026-01": { "workouts": 17, "totalSets": 503, "totalTonnageKg": 191343, ... }
  },
  "meta": {
    "source": "workouts_2026.xlsx",
    "rangeStart": "2026-01-02",
    "rangeEnd": "2026-04-23",
    "workoutCount": 60,
    "exerciseCount": 57
  }
}
```

## Как перегенерировать

Если обновишь свой xlsx, положи его в эту папку как `workouts_2026.xlsx` и запусти:

```bash
cd prototype/mock_data
python3 _build.py
```

Или указать путь явно:

```bash
MOCK_SOURCE=/path/to/file.xlsx python3 _build.py
```

## Что интересного в данных

- **Смена программы** в феврале: до этого был январский 2-дневный split с тренировками "1 ..." и "2 ...", с февраля — PPL+Arms (4 дня, ".1 Chest Triceps", ".2 Back Biceps", ".3 Legs", ".4 Shoulders Arms"). Хорошая основа для будущего сценария "ежемесячный пост-анализ" — можно реально показать "вот почему ты сменил программу".
- **Топ упражнений по количеству подходов:** Machine Chest Press, Lateral Raise Machine, Smith Machine Incline Bench Press, Dip, Lat Pulldown Wide, Leg Press. Это ядро программы.
- **Прогресс весов** явно виден: Machine Chest Press от 60 кг до 81 кг за 4 месяца, Leg Press до 130 кг. Хорошие данные для демо-графиков.

## Замечания парсера

- Формат ячейки `reps×weight` (например, `10×60`) или `reps` (bodyweight).
- `20×50` в Crunches распарсилось как 20 повторов × 50 кг — вероятно, это была опечатка или другой смысл, но парсер формально интерпретировал как задано. Можно подчистить в исходнике при желании.
- Варианты тренировок типа "`.4 Shoulders Arms (короткая, 8:12)`" считаются отдельными именами — это нормально для честной статистики.

## Использование в прототипе

Сейчас мокап `prototype/mockup_v1.html` использует собственные константы `mockProgram`. Чтобы подцепить эти данные, есть два пути:

1. **Inline:** встроить JSON как JavaScript-константу в mockup (просто и работает через `file://`, но раздует HTML до ~260 KB).
2. **Fetch:** подгружать через `fetch('./mock_data/workouts.json')`. Требует локального dev-сервера — `file://` не даст.

Для dev-сервера можно запустить что-то вроде `python3 -m http.server 8000` из папки `prototype/` — тогда открывается `http://localhost:8000/mockup_v1.html` и fetch работает.
