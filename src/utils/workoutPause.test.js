import { beforeEach, expect, it, vi } from 'vitest'
import { apiGet, apiPatch } from './api.js'
import { changeWorkoutPause } from './workoutPause.js'
vi.mock('./api.js', () => ({ apiGet: vi.fn(), apiPatch: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

it('waits for the last set before pausing and returns server timestamps', async () => {
  let saved
  const pending = new Promise(resolve => { saved = resolve })
  const workout = { id: 'w', pausedAt: '2026-10-25T10:00:00Z', totalPausedMs: 1000 }
  apiPatch.mockResolvedValue({ workout })
  const result = changeWorkoutPause('w', 'pause', [pending])
  expect(apiPatch).not.toHaveBeenCalled()
  saved()
  expect(await result).toEqual({ workout, failed: false })
  expect(apiPatch).toHaveBeenCalledWith('/api/v1/workouts/w', { action: 'pause' })
})

it('recovers a committed resume when its response is lost', async () => {
  const workout = { id: 'w', pausedAt: null, totalPausedMs: 9000 }
  apiPatch.mockRejectedValue(new Error('timeout'))
  apiGet.mockResolvedValue({ workout })
  expect(await changeWorkoutPause('w', 'resume')).toEqual({ workout, failed: true })
})

it('does not invent an optimistic state when offline', async () => {
  apiPatch.mockRejectedValue(new Error('offline'))
  apiGet.mockRejectedValue(new Error('offline'))
  expect(await changeWorkoutPause('w', 'resume')).toEqual({ workout: null, failed: true })
})

it('never applies the state of a different workout', async () => {
  apiPatch.mockRejectedValue(new Error('404'))
  apiGet.mockResolvedValue({ workout: { id: 'another' } })
  expect(await changeWorkoutPause('w', 'pause')).toEqual({ workout: null, failed: true })
})
