-- Web-авторизация (Better Auth) — шаг 1: ручные изменения таблицы "User".
-- См. product/ARCHITECTURE_WEB_AUTH.md §3.3.
--
-- Порядок применения:
--   0. Зафиксировать timestamp (Neon PITR) перед применением.
--   1. Выполнить этот скрипт в Neon SQL Editor.
--   2. cd server && npx prisma db push
--      → создаст новые таблицы Session/Account/Verification/RateLimit (безопасно),
--        по "User" увидит "already in sync".
--
-- Все операции неразрушающие: DROP NOT NULL + добавление nullable-колонок.

BEGIN;

-- Web-only юзеры не имеют telegramId
ALTER TABLE "User" ALTER COLUMN "telegramId" DROP NOT NULL;

-- Email-вход (Better Auth). Nullable: у TG-юзеров email нет.
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

COMMIT;
