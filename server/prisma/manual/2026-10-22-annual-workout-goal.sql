-- Additive only. Apply before deploying the regenerated Prisma client.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "annualWorkoutGoal" JSONB;
