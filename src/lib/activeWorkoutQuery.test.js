import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { apiGet } from '../utils/api.js'
import { activeWorkoutQueryOptions, fetchActiveWorkout } from './activeWorkoutQuery.js'
import { queryKeys } from './queryKeys.js'

vi.mock('../utils/api.js', () => ({ apiGet: vi.fn() }))
let client
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
})
afterEach(() => { client.clear(); vi.useRealTimers() })

it.each([
  new TypeError('Failed to fetch'),
  new DOMException('Timed out', 'AbortError'),
  Object.assign(new Error('Unavailable'), { status: 503 }),
])('recovers from one transient failure without requiring a manual retry: %s', async error => {
  const data = { workout: { id: 'w', pausedAt: '2026-10-25T10:00:00Z' } }
  apiGet.mockRejectedValueOnce(error).mockResolvedValueOnce(data)
  const request = fetchActiveWorkout(client)
  await vi.advanceTimersByTimeAsync(1000)
  expect(await request).toEqual(data)
  expect(apiGet).toHaveBeenCalledTimes(2)
  expect(apiGet.mock.calls[0][1]).toMatchObject({ timeout: 30_000 })
  expect(apiGet.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
})

it.each([401, 403, 404, 429])('does not retry HTTP %s', async status => {
  const error = Object.assign(new Error('HTTP failure'), { status })
  apiGet.mockRejectedValue(error)
  await expect(fetchActiveWorkout(client)).rejects.toBe(error)
  expect(apiGet).toHaveBeenCalledTimes(1)
})

it('bounds retries when the network stays unavailable', async () => {
  apiGet.mockRejectedValue(new TypeError('offline'))
  const result = expect(fetchActiveWorkout(client)).rejects.toThrow('offline')
  await vi.advanceTimersByTimeAsync(1000)
  await result
  expect(apiGet).toHaveBeenCalledTimes(2)
})

it('reads fresh server state even when Home has a fresh cached workout', async () => {
  client.setQueryData(queryKeys.workouts.active, { workout: { id: 'old' } })
  apiGet.mockResolvedValue({ workout: { id: 'new' } })
  expect(await fetchActiveWorkout(client)).toEqual({ workout: { id: 'new' } })
})

it('deduplicates simultaneous Home and Workout reads', async () => {
  let resolve
  apiGet.mockReturnValue(new Promise(r => { resolve = r }))
  const home = client.fetchQuery(activeWorkoutQueryOptions())
  const workout = fetchActiveWorkout(client)
  expect(apiGet).toHaveBeenCalledTimes(1)
  resolve({ workout: null })
  expect(await home).toEqual(await workout)
})

it('does not retry a cancelled query', async () => {
  apiGet.mockImplementation((_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const result = fetchActiveWorkout(client).catch(error => error)
  await client.cancelQueries({ queryKey: queryKeys.workouts.active })
  await vi.advanceTimersByTimeAsync(2000)
  await result
  expect(apiGet).toHaveBeenCalledTimes(1)
})
