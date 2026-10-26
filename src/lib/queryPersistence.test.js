import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { restoreQueries, subscribePersistence, clearPersistedQueries, shouldPersistQuery } from './queryPersistence.js'
import { queryKeys } from './queryKeys.js'

function memoryStorage() {
  const data = new Map()
  return {
    get length() { return data.size },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

describe('queryPersistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('сохраняет белый список и восстанавливает его у того же юзера', async () => {
    const qc = new QueryClient()
    const stop = subscribePersistence(qc, 'u1')
    qc.setQueryData(queryKeys.stats.year, { done: 62 })
    qc.setQueryData(queryKeys.exercises.detail('x'), { id: 'x' }) // не в белом списке
    await vi.advanceTimersByTimeAsync(1000)
    stop()

    const fresh = new QueryClient()
    restoreQueries(fresh, 'u1')
    expect(fresh.getQueryData(queryKeys.stats.year)).toEqual({ done: 62 })
    expect(fresh.getQueryData(queryKeys.exercises.detail('x'))).toBeUndefined()
  })

  it('чужой кэш не восстанавливается и удаляется', async () => {
    const qc = new QueryClient()
    const stop = subscribePersistence(qc, 'u1')
    qc.setQueryData(queryKeys.stats.year, { done: 62 })
    await vi.advanceTimersByTimeAsync(1000)
    stop()

    const other = new QueryClient()
    restoreQueries(other, 'u2')
    expect(other.getQueryData(queryKeys.stats.year)).toBeUndefined()
    expect(localStorage.length).toBe(0)
  })

  it('старше суток — не восстанавливается', async () => {
    const qc = new QueryClient()
    const stop = subscribePersistence(qc, 'u1')
    qc.setQueryData(queryKeys.progress, { ok: true })
    await vi.advanceTimersByTimeAsync(1000)
    stop()

    vi.setSystemTime(Date.now() + 25 * 60 * 60_000)
    const fresh = new QueryClient()
    restoreQueries(fresh, 'u1')
    expect(fresh.getQueryData(queryKeys.progress)).toBeUndefined()
  })

  it('pending-инсайт не персистится', () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.insights.today, { text: 'шаблон', pending: true })
    expect(shouldPersistQuery(qc.getQueryCache().find({ queryKey: queryKeys.insights.today }))).toBe(false)
    qc.setQueryData(queryKeys.insights.today, { text: 'реплика' })
    expect(shouldPersistQuery(qc.getQueryCache().find({ queryKey: queryKeys.insights.today }))).toBe(true)
  })

  it('clearPersistedQueries стирает всё сохранённое', async () => {
    const qc = new QueryClient()
    const stop = subscribePersistence(qc, 'u1')
    qc.setQueryData(queryKeys.stats.year, { done: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    stop()
    localStorage.setItem('other-key', 'keep')
    clearPersistedQueries()
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('other-key')).toBe('keep')
  })
})
