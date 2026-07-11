-- ═══════════════════════════════════════════════════════════════════════
-- Версия для Neon SQL Editor (console.neon.tech → проект → SQL Editor).
-- Без CONCURRENTLY: редактор Neon выполняет запросы в транзакции, а
-- CREATE INDEX CONCURRENTLY в транзакции запрещён. На текущем масштабе
-- (таблицы маленькие) обычный CREATE INDEX блокирует на миллисекунды — ок.
--
-- Если БД вырастет — используй parallel-файл 2026-07-11-indexes-fk.sql
-- (CONCURRENTLY) через psql с ПРЯМЫМ (не pooled) connection string Neon.
--
-- ПЕРЕД ЗАПУСКОМ: зафиксируй timestamp для Neon PITR (на случай отката).
-- Имена индексов/констрейнта = как у Prisma → после `db push` будет «in sync».
-- Идемпотентно: повторный запуск безопасен.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Индексы ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Workout_userId_finishedAt_idx"
  ON "Workout" ("userId", "finishedAt");

CREATE INDEX IF NOT EXISTS "Workout_programId_idx"
  ON "Workout" ("programId");

CREATE INDEX IF NOT EXISTS "Exercise_aliases_idx"
  ON "Exercise" USING GIN ("aliases");

-- ── FK WorkoutPlanOverride.programId → Program.id (ON DELETE CASCADE) ───
-- (диагностика — сколько сирот удалим; можно прогнать отдельно перед DELETE)
--   SELECT count(*) FROM "WorkoutPlanOverride" o
--   WHERE NOT EXISTS (SELECT 1 FROM "Program" p WHERE p.id = o."programId");

DELETE FROM "WorkoutPlanOverride" o
  WHERE NOT EXISTS (SELECT 1 FROM "Program" p WHERE p.id = o."programId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkoutPlanOverride_programId_fkey'
  ) THEN
    ALTER TABLE "WorkoutPlanOverride"
      ADD CONSTRAINT "WorkoutPlanOverride_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "Program"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
