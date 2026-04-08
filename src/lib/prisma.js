// src/lib/prisma.js
// ─────────────────────────────────────────────────────────────────────────────
// Singleton de Prisma Client para Next.js
// En desarrollo evita crear múltiples conexiones con hot-reload
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
