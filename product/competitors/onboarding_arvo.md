# Arvo Onboarding — Полное описание экранов
> URL: arvo.guru/onboarding | Дата: 2026-05-23
> Всего шагов: 9

Навигация (прогресс-бар вверху): Level → Profile → Goals → Split → Weak Points → Equipment → Approach → Strength → Review

---

## Шаг 1 / 9 — LEVEL
**URL:** /onboarding/level

### Заголовок
- Метка: `01 · LEVEL`
- Заголовок: **What's your experience level?**
- Подзаголовок: "We tailor the flow and your first workout based on how much you've already trained in the gym."

### Варианты выбора (radio group, выбор одного)
| Вариант | Описание | Уточнение |
|---|---|---|
| **Beginner** | I'm new to structured weightlifting. | Never followed a program or you train casually. |
| **Intermediate** | I have experience with structured training. | 1-3 years of consistent training, you know the basics. |
| **Advanced** | I'm an experienced athlete with years of training. | 3+ years structured, you know periodization and advanced techniques. |

### Кнопки
- **Continue** — переход к следующему шагу

---

## Шаг 2 / 9 — PROFILE
**URL:** /onboarding/profile

### Заголовок
- Метка: `02 · PROFILE`
- Заголовок: **Your profile**
- Подзаголовок: "Help us calibrate volume, intensity and progressions to your body."
- Уточнение: "All fields except gender are optional."

### Tip-блок
> Sharing this data lets us personalize volume and compute realistic strength standards.

### Поля формы
| Поле | Тип | Обязательное | Примечание |
|---|---|---|---|
| **Name** | text input | Нет | Placeholder: "E.g. Alex" |
| **Gender** | radio (3 варианта) | **Да** | Male / Female / Other |
| **Body Type** | кнопки (3 варианта) | Нет | Ectomorph / Mesomorph / Endomorph |
| **Training Focus** | radio (3 варианта) | Нет | Upper Body / Lower Body / Balanced |
| **Age** | number input | Нет | Placeholder: "28", единица: "years" |
| **Body weight** | number input | Нет | Placeholder: "75", единица: "kg" |
| **Height** | number input | Нет | Placeholder: "180", единица: "cm" |

### Кнопки
- **Skip profile** — пропустить шаг
- **Continue** — переход к следующему шагу

---

## Шаг 3 / 9 — GOALS
**URL:** /onboarding/goals

### Заголовок
- Метка: `03 · GOALS`
- Заголовок: **What phase are you in?**
- Подзаголовок: "Your phase determines how we personalize volume, intensity and calories."

### Tip-блок
> Pick the phase that matches your priorities. Mentioning any injuries helps us adapt the exercises.

### Секция 1: Выбор фазы (radio group, выбор одного)
| Вариант | Описание |
|---|---|
| **Bulk** | Caloric surplus to build mass and strength. |
| **Cut** | Caloric deficit to lose fat while preserving muscle. |
| **Maintenance** | Maintenance calories to stabilize weight and composition. |
| **Recomposition** | Moderate calories to build muscle and lose fat at the same time. |

### Секция 2: Травмы и ограничения (опционально)
- Заголовок: **Any pain or physical limitations?** (optional)
- Поле: textarea, placeholder: "Tell us about any pain, past injuries or limitations we should consider..."
- Пример: "E.g. knee pain, shoulder issues, limited mobility."
- Подсказка: "This info helps us pick safer exercises that fit you."

### Кнопки
- **Continue** — переход к следующему шагу

---

## Шаг 4 / 9 — SPLIT
**URL:** /onboarding/split

### Заголовок
- Метка: `04 · SPLIT`
- Заголовок: **Pick your split**
- Подзаголовок: "Choose how to distribute muscle groups across the week."

### Tip-блок
> Training frequency and experience level help determine the best split for you.

### Варианты сплита (radio group, выбор одного)
| Вариант | Описание | Частота |
|---|---|---|
| **Full body** | All major muscle groups every session. Perfect for fewer training days. | 2-4 days/week |
| **Upper / Lower** | Alternate upper and lower body. Great for strength and recovery. | 4-6 days/week |
| **Push / Pull / Legs** | Push, pull and legs on separate days. Balanced development and high frequency. | 3-6 days/week |
| **Bro split** | One muscle group per day: chest, back, shoulders, arms, legs. | 5-6 days/week (min 5 required) |
| **Weak point focus** | A split that emphasizes one muscle group 3-4 times per cycle. | 4-6 days/week |
| **Custom** | Let the AI build a split tailored to you. | Variable |

### Поле: Количество дней в неделю
- Лейбл: "How many days a week can you train?"
- Подсказка: "Helps optimize the split and how volume is distributed."
- Тип: number input, единица: "days / week"
- Подсказка-рекомендация под полем (динамическая, например: "Upper/Lower or PPL give the best mix of frequency and recovery.")

### Кнопки
- **Continue** — переход к следующему шагу

---

## Шаг 5 / 9 — WEAK POINTS
**URL:** /onboarding/weak-points

### Заголовок
- Метка: `STEP 05 · WEAK POINTS`
- Заголовок: **Your weak points.**
- Подзаголовок: "Tap up to 3 areas you want to push harder. Arvo will prioritize them in the upcoming blocks."
- Примечание: "Optional step · you can also skip"

### Выбор групп (кнопки, мультиселект, max 3)
Chest / Back / Shoulders / Arms / Legs / Core / Glutes / Calves

- Счётчик: "X/3 selected"
- При достижении лимита: "Limit reached · remove one to swap"

### Подробная карта мышц (Detailed Map, сворачиваемый блок)
- Кнопка "+ DETAILED MAP" — открывает интерактивную анатомическую карту
- Карта: силуэт тела с кликабельными зонами мышц
- Переключение: **Front** / **Back** (вид спереди/сзади)
- Под картой: теги выбранных мышц с крестиком для удаления (например: "Back Width ×", "Upper Chest ×", "Biceps ×")

### Кнопки
- **Skip this step** — пропустить
- **Continue · N selected** — продолжить с выбранными группами

---

## Шаг 6 / 9 — EQUIPMENT
**URL:** /onboarding/equipment

### Заголовок
- Метка: `STEP 06 · EQUIPMENT`
- Заголовок: **What do you have available?**
- Подзаголовок: "Tap what you actually use. Arvo will only build workouts you can perform."

### Быстрые пресеты (3 кнопки вверху)
| Пресет | Описание |
|---|---|
| Minimal Home | Dumbbells + bands + bodyweight |
| Garage Gym | Barbell · rack · bench |
| Full Gym | Everything · machines · cables |

### Промо-блок: Arvo Mobile
- "Scan your gym" — Photograph the rack or a machine · the app recognizes it and adds the equipment in 2 seconds.
- Available on iOS + Android → ссылка "Download the app →"

### Equipment Selection
- Счётчик: "N items selected"
- Кнопки: **Select All** / **Clear All**

**Quick Presets (внутри секции):**
Full Gym / Home Gym (Basic) / Home Gym (Advanced) / Machines Only / Free Weights Only / Minimal Setup / Bodyweight Only / Hotel Gym / Planet Fitness Style / CrossFit Box / Powerlifting Gym

**Категории оборудования (сворачиваемые):**
| Категория | Кол-во единиц |
|---|---|
| Free Weights | 5 |
| Cable Machines | 6 |
| Plate-Loaded Machines | 9 |
| Selectorized Machines | 28 |
| Bodyweight Stations | 5 |
| Specialty Equipment | 7 |
| Cardio Equipment | 8 |
| Benches & Racks | 9 |
| Resistance Accessories | 6 |
| Functional Equipment | 5 |

Каждая единица оборудования имеет: чекбокс + название + описание использования + кнопку **Preview**.

**Free Weights (примеры):**
- Barbell — Compound lifts, Heavy loading
- Dumbbells — Versatile training, Unilateral work
- EZ Bar — Curls, Skullcrushers
- Trap Bar / Hex Bar — Deadlifts, Carries
- Kettlebells — Dynamic movements, Swings

### Кнопки
- **Continue** (плавающая кнопка внизу со счётчиком "N selected")

---

## Шаг 7 / 9 — APPROACH
**URL:** /onboarding/approach

*(Подробное описание всех методологий — см. arvo-methodologies-full.md)*

### Заголовок
- Метка: `STEP 07 · APPROACH`
- Заголовок: **How do you train?**
- Подзаголовок: "Two philosophies. One choice. You can always switch later."

### AI-блок
- "Arvo analyzes profile + goal + equipment and suggests the best approach."
- Кнопка: **Get AI recommendation**

### Два основных варианта (radio group)
| Вариант | Описание | Для |
|---|---|---|
| **VOLUME FIRST** — Pump · Growth | More sets, moderate RIR, 8-15 reps. Classic hypertrophy — the most direct way to build mass. | BODYBUILDING · AESTHETICS |
| **STRENGTH FIRST** — Strength · Performance | Fewer sets, more load, 3-6 reps. Pure strength — also a foundation for those after long-term mass. | POWERLIFTING · PERFORMANCE |

### Раскрытая библиотека (Browse the full library)
- "Arvo includes 12+ philosophies (Westside, Hypertrophy specialization, 5/3/1, RP…)"
- Кнопка: **Browse the full library** — открывает список всех методологий
- Каждая методология: название, автор, уровень, краткое описание, Working Sets / Rep Ranges / RIR / Progression + кнопка **Learn More**

**Доступные методологии:** DC Training (Doggcrapp), Evidence-Based Progressive Overload, FST-7, Heavy Duty, Kuba Method, Mountain Dog Training, RTS/DUP Autoregulated, Sheiko, Wendler 5/3/1, Westside/Conjugate, Y3T

---

## Шаг 8 / 9 — STRENGTH BASELINE
**URL:** /onboarding/strength

### Заголовок
- Метка: `STEP 08 · STRENGTH BASELINE`
- Заголовок: **Your 3 main lifts.**
- Подзаголовок: "Squat · Bench · Deadlift. A recent number for each is enough — Arvo calibrates the rest."
- Примечание: "Optional step · you can skip and calibrate later"

### Три карточки подъёмов (Back Squat / Bench Press / Deadlift)
Каждая карточка содержит 3 поля:
- **WEIGHT (kg)** — text input, placeholder: "e.g. 100"
- **REPS** — text input, placeholder: "e.g. 5"
- **RIR** — text input, placeholder: "e.g. 2"

Пояснение: "Reps in reserve · 0 = max effort · 4 = easy"

### Слайдер уверенности
- Лейбл: **HOW SURE ARE YOU?**
- Описание: "Tell us how well these numbers reflect your current level."
- Тип: range slider
- Значения: Low · estimate | Medium | High · real numbers

### Добавить больше подъёмов (раскрываемый блок)
- "Want to add more lifts?"
- "Overhead press, hip thrust, row… More data = a more accurate experience estimate."
- Кнопка: **+ Add lift**

### Информационный блок
> WHY ONLY 3 LIFTS? Squat, Bench and Deadlift cover ~80% of movement patterns. Enough to estimate your level.

### Кнопки
- **Skip — I'll calibrate later** — пропустить
- **Continue · N lifts** — продолжить

---

## Шаг 9 / 9 — REVIEW
**URL:** /onboarding/review

### Заголовок
- Метка: `STEP 09 · REVIEW`
- Заголовок: **All set.**
- Подзаголовок: "Check the data. Hit GENERATE and Arvo builds your split in ~30 seconds."

### Сводные блоки (каждый с кнопкой Edit)

**LEVEL**
- Выбранный уровень (например: Intermediate)

**APPROACH**
- Выбранная методология + краткое описание (например: DC Training (Doggcrapp))

**SPLIT**
- TYPE: тип сплита (например: Custom)
- FREQUENCY: частота тренировок (например: 4 Days/Week)

**PROFILE**
- NAME | GENDER
- AGE | WEIGHT
- HEIGHT

**WEAK POINTS**
- Теги выбранных слабых мест (например: back width, chest upper, biceps)

**EQUIPMENT**
- Список всего выбранного оборудования в виде тегов

**STRENGTH BASELINE**
- Введённые подъёмы в формате: Упражнение — вес × повторения @ RIR (например: Bench Press — 70kg × 8 @ RIR 0)

**ESTIMATED EXPERIENCE** *(автоматически рассчитывается AI)*
- "Based on your strength numbers"
- ESTIMATED LEVEL: Novice / Beginner / Intermediate / Advanced
- ESTIMATED EXPERIENCE: X.X Years
- Confidence: XX%

**WHAT HAPPENS NEXT**
- "Arvo generates the split + today's workout calibrated on [методология] and your data. It takes ~30 seconds."

### Кнопки
- **GENERATE MY PLAN** (главная CTA кнопка) — запускает генерацию плана
- **I'd rather build it manually** — альтернатива: построить план вручную

---

## Общая структура онбоардинга

| Шаг | URL | Название | Тип | Обязательный |
|---|---|---|---|---|
| 1 | /onboarding/level | Level | Radio group (3 варианта) | Да |
| 2 | /onboarding/profile | Profile | Форма (7 полей) | Частично (Gender обязателен) |
| 3 | /onboarding/goals | Goals | Radio + Textarea | Да (фаза) |
| 4 | /onboarding/split | Split | Radio + Number input | Да |
| 5 | /onboarding/weak-points | Weak Points | Multi-select + тело-карта | Нет (Optional) |
| 6 | /onboarding/equipment | Equipment | Чекбоксы по категориям | Нет |
| 7 | /onboarding/approach | Approach | Radio + библиотека методологий | Да |
| 8 | /onboarding/strength | Strength Baseline | 3 карточки + слайдер | Нет (Optional) |
| 9 | /onboarding/review | Review | Сводка + GENERATE | — |

### Паттерны UX
- Прогресс-бар с названиями шагов в верхней части (всегда виден)
- Кнопка ← Back на каждом шаге (кроме шага 1)
- Tip-блоки с синей иконкой на ключевых шагах
- Необязательные шаги имеют "Skip" кнопку
- Шаг 9 (Review) показывает всё введённое с возможностью редактировать каждый раздел
- AI-рекомендации доступны на шагах Approach и Strength
