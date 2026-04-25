import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

// GET /api/v1/tarifarios/:id/lineas
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const tarifarioId = parseInt(params.id)
  if (isNaN(tarifarioId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const lineas = await prisma.tarifarioLinea.findMany({
    where: { tarifarioId },
    include: {
      perfil:   { select: { id: true, nombre: true, nivel: true } },
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { perfil: { nombre: 'asc' } },
  })

  return NextResponse.json({ success: true, data: lineas })
}

// POST /api/v1/tarifarios/:id/lineas
// Upsert: unique(tarifarioId, perfilId, empleadoId)
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const tarifarioId = parseInt(params.id)
  if (isNaN(tarifarioId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { perfilId, empleadoId, precioHora } = await request.json()

  const errors = {}
  if (!perfilId)                               errors.perfilId   = ['Requerido']
  if (!empleadoId)                             errors.empleadoId = ['Requerido']
  if (precioHora === undefined || precioHora < 0) errors.precioHora = ['Debe ser 0 o mayor']

  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors }, { status: 422 })
  }

  const linea = await prisma.tarifarioLinea.upsert({
    where: { tarifarioId_perfilId_empleadoId: { tarifarioId, perfilId: parseInt(perfilId), empleadoId: parseInt(empleadoId) } },
    update: { precioHora: Number(precioHora) },
    create: { tarifarioId, perfilId: parseInt(perfilId), empleadoId: parseInt(empleadoId), precioHora: Number(precioHora) },
    include: {
      perfil:   { select: { id: true, nombre: true, nivel: true } },
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
  })

  return NextResponse.json({ success: true, data: linea, message: 'Línea guardada' })
}

// DELETE /api/v1/tarifarios/:id/lineas?lineaId=X
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const lineaId = parseInt(searchParams.get('lineaId'))
  if (isNaN(lineaId)) return NextResponse.json({ success: false, message: 'lineaId inválido' }, { status: 400 })

  await prisma.tarifarioLinea.delete({ where: { id: lineaId } })
  return NextResponse.json({ success: true, message: 'Línea eliminada' })
}
