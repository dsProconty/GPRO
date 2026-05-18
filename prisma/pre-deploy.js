/**
 * pre-deploy.js — Corre ANTES de prisma db push en el build de Vercel.
 * Elimina constraints/índices que Prisma no puede manejar directamente.
 */
'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Prisma intenta DROP INDEX en lugar de DROP CONSTRAINT,
  // lo que PostgreSQL rechaza. Lo hacemos manualmente primero.
  await prisma.$executeRaw`
    ALTER TABLE facturas
    DROP CONSTRAINT IF EXISTS facturas_num_factura_key
  `
  console.log('pre-deploy: constraint facturas_num_factura_key eliminada (o ya no existía)')
}

main()
  .catch(e => {
    // No fallar el build si la constraint no existe o ya fue eliminada
    console.warn('pre-deploy warning:', e.message)
  })
  .finally(() => prisma.$disconnect())
