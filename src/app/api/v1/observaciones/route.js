import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ success: false, message: 'proyecto_id requerido' }, { status: 400 })

  const observaciones = await prisma.observacion.findMany({
    where: { proyectoId: parseInt(proyectoId) },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: observaciones, message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OBSERVACIONES.CREAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para agregar observaciones' }, { status: 403 })
  }

  const body = await request.json()
  const { proyectoId, descripcion } = body

  const errors = {}
  if (!proyectoId) errors.proyectoId = ['El proyecto es requerido']
  if (!descripcion?.trim()) errors.descripcion = ['La descripción es requerida']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  const proyecto = await prisma.proyecto.findUnique({ where: { id: parseInt(proyectoId) } })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 422 })

  // RN-03: id_user SIEMPRE del token, nunca del body
  const observacion = await prisma.observacion.create({
    data: {
      proyectoId: parseInt(proyectoId),
      descripcion: descripcion.trim(),
      userId: parseInt(session.user.id),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json({ success: true, data: observacion, message: 'Observación registrada' }, { status: 201 })
}

// RN-03: No hay PUT ni DELETE — 405
export async function PUT() {
  return NextResponse.json({ success: false, message: 'Método no permitido' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ success: false, message: 'Método no permitido' }, { status: 405 })
}
