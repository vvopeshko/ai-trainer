// Additive migration only; existing workout/history rows are untouched.
// Run before deploying a Prisma client generated from the updated schema.
// node --env-file=.env scripts/addWorkoutPlanSnapshot.js [--apply]
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try {
  const columns = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Workout' AND column_name = 'planSnapshot'`
  if (columns.length) console.log('Workout.planSnapshot already exists')
  else if (!process.argv.includes('--apply')) console.log('Dry run: add nullable JSONB column Workout.planSnapshot; no existing rows will be changed')
  else {
    console.log('Before additive migration:', new Date().toISOString())
    await prisma.$executeRaw`ALTER TABLE "Workout" ADD COLUMN IF NOT EXISTS "planSnapshot" JSONB`
    console.log('Added nullable Workout.planSnapshot')
  }
} finally { await prisma.$disconnect() }
