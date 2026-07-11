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

  describe('prisma error codes', () => {
    it('maps P2002 (unique violation) to 400', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = new Error('Unique constraint failed on the fields: (`slug`)')
      err.code = 'P2002'
      const res = mockRes()
      errorHandler(err, mockReq, res, () => {})

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('Record already exists (unique constraint violation)')
      console.warn.mockRestore()
    })

    it('maps P2003 (FK violation) to 400', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = new Error('Foreign key constraint failed on the field: `exerciseId`')
      err.code = 'P2003'
      const res = mockRes()
      errorHandler(err, mockReq, res, () => {})

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('Referenced record does not exist')
      console.warn.mockRestore()
    })

    it('maps P2025 (record not found) to 404', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = new Error('An operation failed because it depends on one or more records that were required but not found')
      err.code = 'P2025'
      const res = mockRes()
      errorHandler(err, mockReq, res, () => {})

      expect(res.statusCode).toBe(404)
      expect(res.body.error).toBe('Record not found')
      console.warn.mockRestore()
    })

    it('does not leak internal prisma message to the client', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = new Error('Invalid `prisma.workoutSet.create()` invocation: secret internals')
      err.code = 'P2003'
      const res = mockRes()
      errorHandler(err, mockReq, res, () => {})

      expect(JSON.stringify(res.body)).not.toContain('secret internals')
      console.warn.mockRestore()
    })

    it('leaves unknown prisma-like codes to the generic 500 branch', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const err = new Error('Query engine exploded')
      err.code = 'P1001'
      const res = mockRes()
      errorHandler(err, mockReq, res, () => {})

      expect(res.statusCode).toBe(500)
      expect(res.body.error).toBe('Internal Server Error')
      console.error.mockRestore()
    })
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
