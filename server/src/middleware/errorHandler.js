import { ZodError } from 'zod'

// Централизованный обработчик ошибок Express. Последний в цепочке.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues,
    })
  }

  console.error('[error]', req.method, req.path, err)
  const status = err.status ?? 500
  res.status(status).json({
    error: err.message ?? 'Internal Server Error',
  })
}
