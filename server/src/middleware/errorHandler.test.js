import { describe, it, expect, vi } from 'vitest'
import { ZodError } from 'zod'
import { errorHandler } from './errorHandler.js'

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res },
  }
  return res
}

const mockReq = { method: 'POST', path: '/api/v1/test' }

describe('errorHandler', () => {
  it('returns 400 with issues for ZodError', () => {
    const zodErr = new ZodError([
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' },
    ])
    const res = mockRes()
    errorHandler(zodErr, mockReq, res, () => {})

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Validation failed')
    expect(res.body.issues).toHaveLength(1)
    expect(res.body.issues[0].path).toEqual(['name'])
  })

  it('returns generic message for 500 errors (hides internal details)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Database connection pool exhausted')
    const res = mockRes()
    errorHandler(err, mockReq, res, () => {})

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Internal Server Error')
    console.error.mockRestore()
  })

  it('returns err.message for client errors (status < 500)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Not found')
    err.status = 404
    const res = mockRes()
    errorHandler(err, mockReq, res, () => {})

    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('Not found')
    console.error.mockRestore()
  })

  it('defaults error message to Internal Server Error when no message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = {}
    const res = mockRes()
    errorHandler(err, mockReq, res, () => {})

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Internal Server Error')
    console.error.mockRestore()
  })
})
