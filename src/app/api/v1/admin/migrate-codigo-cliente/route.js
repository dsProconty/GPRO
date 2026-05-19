import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/v1/admin/migrate-codigo-cliente
// Agrega la columna codigo_cliente a la tabla empresas (idempotente)
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  try {
    await prisma.$executeRaw`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS codigo_cliente VARCHAR(10)`
    return NextResponse.json({ success: true, message: 'Columna codigo_cliente creada (o ya existía)' })
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
