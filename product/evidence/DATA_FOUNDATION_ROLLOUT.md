# Evidence data foundation — rollout

**Статус:** schema и pilot corpus развёрнуты в Neon 2026-08-02.

Все evidence-таблицы новые: изменений, переименований или удаления существующих
продуктовых колонок нет. Для ручного Neon rollout подготовлен автономный SQL:
`server/prisma/manual/2026-08-02-evidence-foundation.sql`.

## 1. Preflight

```bash
cd server
npx prisma validate
npx prisma generate
npm run evidence:import-pilot:dry
```

Dry-run валидирует Zod contracts и связи, но не подключается к базе.

Перед production rollout зафиксировать timestamp для Neon PITR. Затем получить
read-only diff текущей БД и schema:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Допустимый diff для evidence-инкремента:

- только `CREATE TABLE`, `CREATE INDEX`, `ADD CONSTRAINT` для evidence-моделей;
- плюс отдельно ожидаемые изменения других явно запланированных веток продукта.

`DROP`, rename или изменение существующих колонок — стоп-сигнал для rollout.

## 2. Schema rollout через Neon SQL Editor

1. Открыть SQL Editor на нужной branch/database.
2. Вставить целиком
   `server/prisma/manual/2026-08-02-evidence-foundation.sql`.
3. Выполнить как один запрос.
4. Последний `SELECT` должен вернуть 11 названий evidence-таблиц, включая audit.

Скрипт обёрнут в транзакцию, повторяем и не содержит `DROP`, `TRUNCATE`, data
`DELETE` или изменений существующих продуктовых таблиц.

Альтернативный CLI rollout проекта:


```bash
npx prisma db push
```

Нельзя использовать `--accept-data-loss`. После выполнения повторный diff должен быть
пустым.

## 3. Pilot import

```bash
npm run evidence:import-pilot:dry
npm run evidence:import-pilot
```

Import выполняется одной транзакцией и идемпотентен. Повторный запуск:

- обновляет draft-карточки;
- не перезаписывает approved assessments, claim versions и recommendations;
- не понижает проверенный correction status работы обратно до `unknown`;
- перестраивает только evidence/recommendation links изменённого draft.

Ожидаемые counts: 10 questions, 19 works, 12 assessments, 15 claim versions,
10 recommendations, 50 AI tests, 6 blog outlines.

## 4. Runtime smoke test

Загруженный pilot целиком `draft`, поэтому database-backed retrieval обязан вернуть:

```text
answerability = unsupported
claims = []
recommendations = []
```

Это ожидаемый fail-closed результат, а не ошибка импорта. Первые runtime guidance
появятся только после scientific approval claim, проверки correction status всех его
works и отдельного approval product recommendation.

## 5. Rollback

До появления production approvals и usages evidence-таблицы изолированы от User,
Program и Workout. При проблеме приложение продолжает работать без обращения к ним.
Для изменения данных предпочтителен Neon PITR; удаление таблиц вручную считается
destructive operation и не входит в автоматический rollout.

## 6. Rollout log — 2026-08-02

- schema создана через Neon SQL Editor автономным evidence-only SQL;
- pilot import завершён в `2026-08-02T13:12:29Z`;
- фактические counts: 10 questions, 19 works, 12 assessments, 15 claim versions,
  10 recommendations, 50 AI tests, 6 blog outlines;
- контрольный повторный import вернул те же counts;
- database-backed retrieval: `unsupported` для 10/10 вопросов, claims и
  recommendations не утекли в runtime;
- все импортированные claim versions/recommendations остаются `draft`;
- первые два preflight import attempts были полностью rolled back из-за interactive
  transaction timeout; после batching round-trips успешный import уложился в timeout.

## 7. Review workflow rollout

Если foundation SQL выполнялся до появления review API, один раз выполнить в Neon
SQL Editor дополнительный файл:

```text
server/prisma/manual/2026-08-02-evidence-review-audit.sql
```

Затем настроить server env allowlists:

```text
EVIDENCE_REVIEWER_IDS=<User.id или tg:telegramId через запятую>
EVIDENCE_APPROVER_IDS=<User.id или tg:telegramId через запятую>
```

Без этих переменных review API fail-closed. `ANALYTICS_SECRET` не открывает доступ к
evidence write endpoints.

## 8. Plain-language и Question workspace rollout — 2026-08-06

Перед деплоем версии с понятными формулировками и детальной страницей вопроса нужно
один раз выполнить в Neon SQL Editor:

```text
server/prisma/manual/2026-08-06-evidence-plain-language-workspace.sql
```

SQL только добавляет новые колонки и безопасно заполняет их текущими текстами как
fallback. После этого запустить pilot import, чтобы загрузить подготовленные RU/EN
формулировки, поисковый контекст и muscle scope:

```bash
cd server
npm run evidence:import-pilot:dry
npm run evidence:import-pilot
```

Порядок важен: новый backend нельзя включать до применения SQL, иначе Prisma будет
запрашивать отсутствующие колонки. Одобренные версии import не перезаписывает; если
такие версии уже существуют, новые поля должен заполнить reviewer отдельной новой
версией claim.
