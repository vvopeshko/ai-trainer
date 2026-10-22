import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('../utils/prisma.js', () => ({ default: { $queryRaw: vi.fn() } }))
import prisma from '../utils/prisma.js'
import { getAnnualGoalStats } from './annualGoalService.js'

beforeEach(() => vi.clearAllMocks())

it('scopes reads to the authenticated user, finished workouts and the current instant', async () => {
  prisma.$queryRaw.mockResolvedValue([{ date: '2026-10-22' }])
  const now = new Date('2026-10-22T17:00:00Z')
  const goal = { year: 2026, target: 200, baselineDate: '2026-07-24', baselineCount: 134, timezone: 'Asia/Yekaterinburg' }
  const result = await getAnnualGoalStats({ id: 'owner', annualWorkoutGoal: goal }, 'UTC', now)
  expect(result.done).toBe(135)
  expect(result.timezone).toBe('Asia/Yekaterinburg')
  const [sql, ...params] = prisma.$queryRaw.mock.calls[0]
  expect(sql.join('?')).toContain('w."userId" = ?')
  expect(sql.join('?')).toContain('w."finishedAt" IS NOT NULL')
  expect(sql.join('?')).toContain('w."finishedAt" <= ?')
  expect(params).toContain('owner')
  expect(params).toContain(now)
})

it('never applies another profile’s baseline to a user with no goal', async () => {
  prisma.$queryRaw.mockResolvedValue([{ date: '2026-10-22' }])
  const result = await getAnnualGoalStats({ id: 'other' }, 'UTC', new Date('2026-10-22T17:00:00Z'))
  expect(result.done).toBe(1)
  expect(result.baselineCount).toBe(0)
})
