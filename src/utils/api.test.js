import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock import.meta.env before importing api.js
vi.stubGlobal('window', {
  Telegram: undefined,
})

// We need to mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock AbortSignal.any if not available in test env
if (!AbortSignal.any) {
  AbortSignal.any = (signals) => {
    const controller = new AbortController()
    for (const signal of signals) {
      if (signal.aborted) { controller.abort(signal.reason); break }
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
    }
    return controller.signal
  }
}

const { apiGet, apiPost, apiPatch, apiDelete } = await import('./api.js')

function jsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  })
}

describe('api.js', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auth header', () => {
    it('sends dev_bypass when no Telegram WebApp', async () => {
      mockFetch.mockReturnValue(jsonResponse({ ok: true }))
      await apiGet('/api/v1/test')

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers.Authorization).toBe('tma dev_bypass')
    })
  })

  describe('apiGet', () => {
    it('returns parsed JSON on success', async () => {
      mockFetch.mockReturnValue(jsonResponse({ workout: { id: '123' } }))
      const result = await apiGet('/api/v1/workouts/active')

      expect(result).toEqual({ workout: { id: '123' } })
      expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/workouts/active')
    })

    it('throws error with status and payload on failure', async () => {
      mockFetch.mockReturnValue(jsonResponse({ error: 'Not found' }, 404))

      await expect(apiGet('/api/v1/missing')).rejects.toMatchObject({
        message: 'Not found',
        status: 404,
        payload: { error: 'Not found' },
      })
    })
  })

  describe('apiPost', () => {
    it('sends JSON body', async () => {
      mockFetch.mockReturnValue(jsonResponse({ workout: { id: '456' } }, 201))
      await apiPost('/api/v1/workouts', { programId: 'abc' })

      const [, options] = mockFetch.mock.calls[0]
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(options.body)).toEqual({ programId: 'abc' })
    })

    it('sends empty object when body is undefined', async () => {
      mockFetch.mockReturnValue(jsonResponse({ ok: true }, 201))
      await apiPost('/api/v1/workouts')

      const [, options] = mockFetch.mock.calls[0]
      expect(JSON.parse(options.body)).toEqual({})
    })
  })

  describe('apiPatch', () => {
    it('sends PATCH method', async () => {
      mockFetch.mockReturnValue(jsonResponse({ workout: {} }))
      await apiPatch('/api/v1/workouts/123', { action: 'finish' })

      const [, options] = mockFetch.mock.calls[0]
      expect(options.method).toBe('PATCH')
    })
  })

  describe('apiDelete', () => {
    it('sends DELETE method', async () => {
      mockFetch.mockReturnValue(jsonResponse({ deleted: true }))
      await apiDelete('/api/v1/workouts/123')

      const [, options] = mockFetch.mock.calls[0]
      expect(options.method).toBe('DELETE')
    })
  })

  describe('error shape', () => {
    it('falls back to HTTP status when json fails', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      }))

      await expect(apiGet('/api/v1/broken')).rejects.toMatchObject({
        message: 'HTTP 500',
        status: 500,
        payload: null,
      })
    })
  })

  describe('signal support', () => {
    it('passes external signal to fetch', async () => {
      mockFetch.mockReturnValue(jsonResponse({ ok: true }))
      const controller = new AbortController()

      await apiGet('/api/v1/test', { signal: controller.signal })

      const [, options] = mockFetch.mock.calls[0]
      // Signal should be present (combined via AbortSignal.any)
      expect(options.signal).toBeDefined()
    })
  })
})
