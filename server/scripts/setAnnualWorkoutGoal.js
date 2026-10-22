// Explicit profile and history checkpoint. No workout records are modified.
// node --env-file=.env scripts/setAnnualWorkoutGoal.js USER_UUID 2026 200 2026-07-24 134 Asia/Yekaterinburg
import prisma from '../src/utils/prisma.js'
import { parseAnnualGoal } from '../src/services/annualGoal.js'

const [userId, year, target, baselineDate, baselineCount, timezone] = process.argv.slice(2)
const goal = parseAnnualGoal({ year: Number(year), target: Number(target), baselineDate, baselineCount: Number(baselineCount), timezone })
try {
  if (!userId || !goal) throw new Error('Expected: USER_UUID YEAR TARGET BASELINE_DATE BASELINE_COUNT TIMEZONE')
  const user = await prisma.user.update({ where: { id: userId }, data: { annualWorkoutGoal: goal }, select: { firstName: true, annualWorkoutGoal: true } })
  console.log(JSON.stringify(user))
} finally {
  await prisma.$disconnect()
}
