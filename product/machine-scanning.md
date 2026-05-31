# Machine Scanning — техническое описание

Распознавание тренажёра по фото: пользователь фотографирует тренажёр в зале → AI определяет, что это → предлагает упражнения.

**Статус:** в разработке (итерация 4)

---

## 1. Зачем

Ключевая фишка продукта. Новичок в зале видит тренажёр, но не знает, что с ним делать. Фотографирует → получает название, список упражнений, инструкции. Без гугла, без подхода к занятому тренеру.

---

## 2. Поток данных (end-to-end)

```
Пользователь фоткает тренажёр в Telegram-боте
  │
  ▼
① Telegraf on('photo') handler
  │  - получает массив PhotoSize[] от Telegram
  │  - берёт последний элемент (максимальное разрешение)
  │  - скачивает файл через Telegram Bot API → Buffer
  │
  ▼
② Конвертация в base64
  │  - Buffer → base64 string
  │  - определяем mediaType (jpeg по умолчанию)
  │
  ▼
③ Вызов сервиса identifyMachine(userId, imageBase64)
  │  - формирует промпт с JSON-схемой ожидаемого ответа
  │  - вызывает llm.vision(imageBase64, prompt)
  │  - парсит JSON из ответа LLM
  │  - валидирует через Zod-схему
  │
  ▼
④ Сохранение в БД
  │  - создаёт запись MachineIdentification
  │  - поля: imageUrl (пока Telegram file_id), recognizedName,
  │    confidence, suggestedExercises[], model
  │
  ▼
⑤ Аналитика (fire-and-forget)
  │  - track('exercise_identified', { confidence, ... })
  │  - или track('exercise_identification_failed') при низком confidence
  │
  ▼
⑥ Ответ пользователю
   - текст: название тренажёра + описание
   - список упражнений с кратким описанием
   - inline-клавиатура: "Начать упражнение" / "Подробнее"
```

---

## 3. Архитектура компонентов

```
server/src/
├── bot/
│   └── index.js                    # + on('photo') handler
│
├── services/
│   └── aiTrainer/
│       ├── identifyMachine.js      # основной сервис
│       └── prompts/
│           └── identifyMachine.md  # system prompt для vision
│
└── utils/
    ├── llm.js                      # уже есть: vision(base64, prompt)
    ├── analytics.js                # уже есть: track()
    └── prisma.js                   # уже есть: singleton client
```

### Что уже есть (не трогаем)
- `utils/llm.js` — `llm.vision(imageBase64, prompt, options)` → `{ text, model, usage }`
- `utils/analytics.js` — `track(userId, event, payload)` fire-and-forget
- `utils/prisma.js` — singleton Prisma client
- `prisma/schema.prisma` — модель `MachineIdentification` уже описана
- `bot/index.js` — Telegraf-бот с командами `/start`, `/workout`, `/help`

### Что создаём
1. **`services/aiTrainer/identifyMachine.js`** — сервис распознавания
2. **`services/aiTrainer/prompts/identifyMachine.md`** — промпт для vision
3. **Хэндлер `on('photo')`** в `bot/index.js`

---

## 4. Сервис `identifyMachine.js`

### Интерфейс

```js
/**
 * @param {string} userId — UUID пользователя из БД
 * @param {string} imageBase64 — base64-encoded изображение (без data: prefix)
 * @param {string} [mediaType='image/jpeg']
 * @returns {Promise<{
 *   id: string,                    // UUID записи MachineIdentification
 *   machineName: string,           // "Тренажёр для жима ногами (Leg Press)"
 *   machineNameEn: string,         // "Leg Press Machine"
 *   confidence: number,            // 0.0–1.0
 *   description: string,           // краткое описание тренажёра
 *   suggestedExercises: Array<{
 *     name: string,                // "Жим ногами"
 *     nameEn: string,              // "Leg Press"
 *     primaryMuscles: string[],    // ["quadriceps", "glutes"]
 *     description: string,         // как выполнять (2-3 предложения)
 *     sets: string,                // "3-4"
 *     reps: string,                // "8-12"
 *   }>,
 *   model: string,                 // "claude-sonnet-4-6"
 * }>}
 */
export async function identifyMachine(userId, imageBase64, mediaType) { ... }
```

### Логика работы

1. Загружает промпт из `prompts/identifyMachine.md`
2. Вызывает `llm.vision()` с промптом
3. Извлекает JSON из ответа (парсинг между ```json ... ```)
4. Валидирует через Zod
5. Сохраняет `MachineIdentification` в БД
6. Стреляет аналитику
7. Возвращает результат

---

## 5. Промпт для vision

### Принципы промпта
- **Роль:** фитнес-эксперт, работающий с фото тренажёров
- **Язык:** ответ на русском (названия дублируем на английском)
- **Формат:** строгий JSON по схеме
- **Confidence:** LLM сам оценивает уверенность (0.0–1.0)
- **Fallback:** при `confidence < 0.5` — предупреждаем пользователя

### JSON-схема ответа (в промпте)

```json
{
  "machineName": "string — название тренажёра на русском",
  "machineNameEn": "string — название на английском",
  "confidence": "number 0.0-1.0 — уверенность в распознавании",
  "description": "string — что это за тренажёр, 1-2 предложения",
  "suggestedExercises": [
    {
      "name": "string — название упражнения на русском",
      "nameEn": "string — на английском",
      "primaryMuscles": ["string — основные мышцы"],
      "description": "string — техника выполнения, 2-3 предложения",
      "sets": "string — рекомендуемое количество подходов",
      "reps": "string — рекомендуемое количество повторений"
    }
  ]
}
```

---

## 6. Обработка в боте

### on('photo') handler

```
1. Показать "typing" индикатор (ctx.sendChatAction('typing'))
2. Получить file_id последнего фото (максимальный размер)
3. Скачать файл через ctx.telegram.getFileLink() → fetch → Buffer
4. Конвертировать Buffer → base64
5. Вызвать identifyMachine(userId, base64)
6. Сформировать ответ:
   - Если confidence >= 0.5 → полный ответ с упражнениями
   - Если confidence < 0.5  → "Не уверен, попробуй сфоткать ближе"
7. Отправить с inline-клавиатурой
```

### Inline-клавиатура

При успешном распознавании:
- `[📋 Подробнее о тренажёре]` — callback с деталями
- `[💪 Упражнение 1]` `[💪 Упражнение 2]` ... — по одной кнопке на упражнение

---

## 7. Модель данных

Используем существующую модель `MachineIdentification` из schema.prisma:

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | PK |
| userId | String | FK → User |
| imageUrl | String | Telegram file_id (позже — R2 URL) |
| recognizedName | String? | Название тренажёра |
| confidence | Float? | 0.0–1.0 |
| suggestedExercises | Json | Массив упражнений от LLM |
| userConfirmed | Boolean? | Подтвердил ли юзер |
| confirmedExerciseId | String? | Выбранное упражнение |
| model | String? | Какая модель LLM |
| createdAt | DateTime | Когда |

---

## 8. Ограничения MVP

- **Без R2:** на первом этапе сохраняем только Telegram `file_id` как imageUrl. Файлы в Telegram живут ограниченное время, но для MVP достаточно. R2 подключим позже.
- **Без привязки к Exercise:** LLM генерирует упражнения из головы, не ссылаясь на `exerciseId` из нашей БД. Привязка к базе упражнений — после seed-скрипта.
- **Без кэширования:** каждое фото — новый вызов LLM. Кэш по визуальному сходству — сложно и не нужно на старте.
- **Только личные сообщения:** бот обрабатывает фото только в личке, не в группах.

---

## 9. Стоимость

На модели `claude-sonnet-4-6` (по ценам Anthropic):
- Input: ~$3/M tokens, фото ~1600 tokens ≈ $0.005
- Output: ~$15/M tokens, ~500 tokens ≈ $0.0075
- **Итого: ~$0.01 за распознавание** (~1 цент)
- 50 тестовых фото = ~$0.55
- 1000 распознаваний/мес = ~$10

---

## 10. План реализации (по шагам)

| # | Шаг | Файл | Что делаем |
|---|-----|------|-----------|
| 1 | Промпт | `services/aiTrainer/prompts/identifyMachine.md` | Пишем system prompt с JSON-схемой |
| 2 | Сервис | `services/aiTrainer/identifyMachine.js` | Логика: LLM → parse → validate → save |
| 3 | Бот-хэндлер | `bot/index.js` | `on('photo')`: скачать → base64 → сервис → ответ |
| 4 | Тест | — | Отправить 3-5 фото тренажёров боту |
| 5 | Итерация | промпт + сервис | Улучшить по результатам тестов |

---

## 11. Будущие улучшения (не в MVP)

- [ ] Загрузка фото в Cloudflare R2 для долговременного хранения
- [ ] Привязка suggestedExercises к реальным `exerciseId` из БД
- [ ] Inline-кнопка "Начать упражнение" → создаёт Workout + первый WorkoutSet
- [ ] Кнопка "Не то" → уточняющий диалог
- [ ] Логирование неудачных распознаваний для улучшения промпта
- [ ] Распознавание из мини-аппа (камера в WebView) помимо бота
- [ ] Поддержка нескольких фото (разные ракурсы) для повышения точности
