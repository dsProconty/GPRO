import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { enviarNotificacionRespuesta } from '@/lib/email'

const OBSERVACION_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  respuestaA: { select: { id: true, descripcion: true, user: { select: { id: true, name: true } } } },
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OBSERVACIONES.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para ver observaciones' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ success: false, message: 'proyecto_id requerido' }, { status: 400 })

  const observaciones = await prisma.observacion.findMany({
    where: { proyectoId: parseInt(proyectoId) },
    include: OBSERVACION_INCLUDE,
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
  const { proyectoId, descripcion, respuestaAId } = body

  const errors = {}
  if (!proyectoId) errors.proyectoId = ['El proyecto es requerido']
  if (!descripcion?.trim()) errors.descripcion = ['La descripción es requerida']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: parseInt(proyectoId) },
    include: { empresa: { select: { nombre: true } } },
  })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 422 })

  // Si responde a otra observacion, validar que exista y sea del mismo proyecto
  let observacionOriginal = null
  if (respuestaAId) {
    observacionOriginal = await prisma.observacion.findUnique({
      where: { id: parseInt(respuestaAId) },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    if (!observacionOriginal || observacionOriginal.proyectoId !== parseInt(proyectoId)) {
      return NextResponse.json({ success: false, message: 'La observación a la que responde no es válida' }, { status: 422 })
    }
    // Un solo nivel de respuesta: no se puede responder a una respuesta
    if (observacionOriginal.respuestaAId) {
      return NextResponse.json({ success: false, message: 'No se puede responder a una respuesta, responde al comentario original' }, { status: 422 })
    }
  }

  // RN-03: id_user SIEMPRE del token, nunca del body
  const observacion = await prisma.observacion.create({
    data: {
      proyectoId: parseInt(proyectoId),
      descripcion: descripcion.trim(),
      userId: parseInt(session.user.id),
      respuestaAId: observacionOriginal ? observacionOriginal.id : null,
    },
    include: OBSERVACION_INCLUDE,
  })

  // Notificar por email al autor original (best-effort: si falla, no revierte la respuesta)
  if (observacionOriginal && observacionOriginal.userId !== parseInt(session.user.id)) {
    try {
      await enviarNotificacionRespuesta({
        proyecto,
        observacionOriginal,
        respuesta: observacion,
        autorRespuestaNombre: session.user.name,
      })
    } catch (err) {
      console.error('[observaciones] error enviando notificacion de respuesta', err)
    }
  }

  return NextResponse.json({ success: true, data: observacion, message: 'Observación registrada' }, { status: 201 })
}

// RN-03: No hay PUT ni DELETE — 405
export async function PUT() {
  return NextResponse.json({ success: false, message: 'Método no permitido' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ success: false, message: 'Método no permitido' }, { status: 405 })
}
