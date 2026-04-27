import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TABLES = [
  'perfiles_consultor',
  'empleados',
  'proyectos',
  'empresas',
  'clientes',
  'facturas',
  'pagos',
  'propuestas',
  'tarifarios',
  'recordatorio_facturas',
]

// GET /api/v1/admin/fix-sequences  (solo admin)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const results = []

  for (const table of TABLES) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(MAX(id), 0) as max_id FROM "${table}"`
      )
      const maxId = Number(rows[0].max_id)

      if (maxId > 0) {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxId}, true)`
        )
        results.push({ table, status: 'fixed', maxId })
      } else {
        results.push({ table, status: 'empty', maxId: 0 })
      }
    } catch (err) {
      results.push({ table, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ success: true, data: results })
}
