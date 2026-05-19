import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/admin/migrate-estado-propuesta
 * Agrega la columna estado_propuesta a la tabla proyectos si no existe.
 * Solo ejecutar una vez. Requiere rol admin.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })
  }

  try {
    await prisma.$executeRaw`
      ALTER TABLE proyectos
      ADD COLUMN IF NOT EXISTS estado_propuesta VARCHAR(30)
    `
    return NextResponse.json({
      success: true,
      message: 'Columna estado_propuesta agregada (o ya existía)',
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
