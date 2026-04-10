import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/v1/proyectos/:id/estado-logs
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const logs = await prisma.proyectoEstadoLog.findMany({
    where: { proyectoId: id },
    include: {
      estadoAnterior: { select: { nombre: true } },
      estadoNuevo: { select: { nombre: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: logs, message: '' })
}
