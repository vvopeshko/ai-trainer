import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  getCachedUser, setCachedUser, invalidateKey, invalidateUser, clearUserCache, invalidateAfterMutation,
} from './userCache.js'

describe('userCache', () => {
  beforeEach(() => {
    clearUserCache()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('отдаёт юзера до истечения TTL (30 с) и забывает после', () => {
    setCachedUser('tg:1', { id: 'u1' })
    vi.advanceTimersByTime(29_000)
    expect(getCachedUser('tg:1')).toEqual({ id: 'u1' })
    vi.advanceTimersByTime(2_000)
    expect(getCachedUser('tg:1')).toBeNull()
  })

  it('TTL не дольше переданного (жизнь сессии)', () => {
    setCachedUser('bearer:t', { id: 'u1' }, 5_000)
    vi.advanceTimersByTime(6_000)
    expect(getCachedUser('bearer:t')).toBeNull()
  })

  it('истёкшая сессия (ttl ≤ 0) не кэшируется', () => {
    setCachedUser('bearer:t', { id: 'u1' }, -1)
    expect(getCachedUser('bearer:t')).toBeNull()
  })

  it('invalidateUser сбрасывает все ключи юзера, чужие не трогает', () => {
    setCachedUser('tg:1', { id: 'u1' })
    setCachedUser('bearer:a', { id: 'u1' })
    setCachedUser('bearer:b', { id: 'u2' })
    invalidateUser('u1')
    expect(getCachedUser('tg:1')).toBeNull()
    expect(getCachedUser('bearer:a')).toBeNull()
    expect(getCachedUser('bearer:b')).toEqual({ id: 'u2' })
  })

  it('invalidateKey сбрасывает один токен', () => {
    setCachedUser('bearer:a', { id: 'u1' })
    invalidateKey('bearer:a')
    expect(getCachedUser('bearer:a')).toBeNull()
  })

  it('мутирующий запрос сбрасывает юзера после ответа, GET — нет', () => {
    setCachedUser('tg:1', { id: 'u1' })
    const getRes = new EventEmitter()
    invalidateAfterMutation({ method: 'GET', user: { id: 'u1' } }, getRes)
    getRes.emit('finish')
    expect(getCachedUser('tg:1')).toEqual({ id: 'u1' })

    const postRes = new EventEmitter()
    invalidateAfterMutation({ method: 'POST', user: { id: 'u1' } }, postRes)
    expect(getCachedUser('tg:1')).toEqual({ id: 'u1' })
    postRes.emit('finish')
    expect(getCachedUser('tg:1')).toBeNull()
  })
})
