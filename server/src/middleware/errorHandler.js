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

  // Известные коды Prisma → клиентские статусы вместо 500.
  // P2002 — unique constraint (дубликат), P2003 — FK violation (ссылка на
  // несуществующую запись, напр. logSet с левым exerciseId), P2025 — not found.
  if (err?.code === 'P2002') {
    console.warn('[error]', req.method, req.path, 'prisma P2002 (unique violation)')
    return res.status(400).json({ error: 'Record already exists (unique constraint violation)' })
  }
  if (err?.code === 'P2003') {
    console.warn('[error]', req.method, req.path, 'prisma P2003 (FK violation)')
    return res.status(400).json({ error: 'Referenced record does not exist' })
  }
  if (err?.code === 'P2025') {
    console.warn('[error]', req.method, req.path, 'prisma P2025 (not found)')
    return res.status(404).json({ error: 'Record not found' })
  }

  console.error('[error]', req.method, req.path, err)
  const status = err.status ?? 500
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : (err.message ?? 'Internal Server Error'),
  })
}
