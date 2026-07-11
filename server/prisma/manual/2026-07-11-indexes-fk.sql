-- ═══════════════════════════════════════════════════════════════════════
-- Ручная миграция: индексы под горячие запросы + FK WorkoutPlanOverride→Program
-- Дата: 2026-07-11 · Соответствует изменениям в prisma/schema.prisma того же дня.
--
-- ЗАЧЕМ РУЧНОЙ SQL (а не `prisma db push`):
--   1. `db push` создаёт индексы БЕЗ CONCURRENTLY — блокирует таблицу на время
--      построения. На проде с живыми юзерами это простой. CONCURRENTLY строит
--      индекс без блокировки записи.
--   2. FK нельзя навесить, пока в таблице есть сироты (programId, указывающий на
--      удалённую программу) — их надо сначала вычистить, иначе ALTER упадёт.
--   Правило проекта (CLAUDE.md): NOT NULL / FK / rename — только ручным SQL,
--   `db push` — уже ПОСЛЕ (увидит «already in sync», т.к. имена совпадают с
--   тем, что генерит Prisma — сверено через `prisma migrate diff`).
--
-- ПЕРЕД ЗАПУСКОМ:
--   • Зафиксируй timestamp для Neon PITR (на случай отката).
--   • Запускай в psql БЕЗ обёртки в BEGIN/COMMIT: CREATE INDEX CONCURRENTLY
--     не работает внутри транзакции. psql в autocommit (по умолчанию) — ок.
--     Пример:  psql "$DATABASE_URL" -f 2026-07-11-indexes-fk.sql
--   • Скрипт идемпотентен: повторный запуск безопасен (IF NOT EXISTS + проверки).
--
-- ПОСЛЕ ЗАПУСКА:
--   `cd server && npx prisma db push` должен сказать «already in sync».
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Индексы (CONCURRENTLY — без блокировки записи) ──────────────────

-- Горячий путь: recent/stats/reminder/buildUserContext фильтруют и сортируют
-- тренировки по finishedAt (сейчас есть только [userId, startedAt]).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Workout_userId_finishedAt_idx"
  ON "Workout" ("userId", "finishedAt");

-- Джойны/фильтры тренировок по программе.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Workout_programId_idx"
  ON "Workout" ("programId");

-- Поиск упражнения по массиву алиасов (unnest/@> в exerciseResolver).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Exercise_aliases_idx"
  ON "Exercise" USING GIN ("aliases");

-- ── 2. FK WorkoutPlanOverride.programId → Program.id (ON DELETE CASCADE) ─
-- Проверь, сколько сирот будет удалено (диагностика, ничего не меняет):
--   SELECT count(*) FROM "WorkoutPlanOverride" o
--     LEFT JOIN "Program" p ON p.id = o."programId"
--   WHERE p.id IS NULL;

-- 2a. Вычистить оверрайды, указывающие на несуществующую программу.
-- Такой оверрайд всё равно мёртв: getNextWorkout/getActive не найдут программу
-- и не подмешают его. Удаление безопасно.
DELETE FROM "WorkoutPlanOverride" o
  WHERE NOT EXISTS (SELECT 1 FROM "Program" p WHERE p.id = o."programId");

-- 2b. Навесить FK. NOT VALID → ADD выполняется быстро (без полного скана под
-- блокировкой); VALIDATE → проверяет существующие строки, НЕ блокируя запись.
-- Имя констрейнта = ровно то, что сгенерит Prisma (db push увидит «in sync»).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkoutPlanOverride_programId_fkey'
  ) THEN
    ALTER TABLE "WorkoutPlanOverride"
      ADD CONSTRAINT "WorkoutPlanOverride_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "Program"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
      NOT VALID;
    ALTER TABLE "WorkoutPlanOverride"
      VALIDATE CONSTRAINT "WorkoutPlanOverride_programId_fkey";
  END IF;
END $$;

-- ── Проверка результата ────────────────────────────────────────────────
--   \d "Workout"                 -- должны быть три индекса
--   \d "WorkoutPlanOverride"     -- должен быть FK на Program
-- ═══════════════════════════════════════════════════════════════════════
