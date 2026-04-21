import { PrismaClient } from '@prisma/client'

// Singleton — иначе при hot-reload (dev) создаётся куча соединений с Postgres.
const prisma = globalThis.__prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma
