import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * POST /api/v1/admin/eliminar-observacion
 * Body: { id: number, aplicar?: boolean }  — default false = solo vista previa.
 *
 * Herramienta correctiva puntual para eliminar una observacion registrada por error
 * (ej: un comentario duplicado que quedo suelto antes de que existiera la funcion de
 * Responder). NO reemplaza la regla de negocio RN-03 (las observaciones normales del
 * sistema siguen siendo inmutables via POST/GET; este endpoint es solo admin y queda
 * registrado en el logger para trazabilidad).
 *
 * No permite eliminar una observacion que tenga respuestas encadenadas (para no dejar
 * respuestas huerfanas apuntando a un comentario que ya no existe).
 */
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })
  }

  const { id, aplicar = false } = await request.json().catch(() => ({}))
  const observacionId = parseInt(id)
  if (isNaN(observacionId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const observacion = await prisma.observacion.findUnique({
    where: { id: observacionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      proyecto: { select: { id: true, detalle: true } },
      respuestaA: { select: { id: true, descripcion: true, user: { select: { name: true } } } },
      respuestas: { select: { id: true } },
    },
  })
  if (!observacion) return NextResponse.json({ success: false, message: 'Observación no encontrada' }, { status: 404 })

  const tieneRespuestas = observacion.respuestas.length > 0

  if (aplicar) {
    if (tieneRespuestas) {
      return NextResponse.json({
        success: false,
        message: `No se puede eliminar: tiene ${observacion.respuestas.length} respuesta(s) encadenada(s).`,
      }, { status: 409 })
    }
    await prisma.observacion.delete({ where: { id: observacionId } })
    logger.info('ADMIN_OBSERVACION_ELIMINADA', {
      observacionId,
      proyectoId: observacion.proyectoId,
      autorOriginal: observacion.user?.name,
      adminUserId: session.user.id,
      adminUserName: session.user.name,
    })
    return NextResponse.json({ success: true, data: null, message: 'Observación eliminada' })
  }

  return NextResponse.json({
    success: true,
    data: {
      id: observacion.id,
      descripcion: observacion.descripcion,
      createdAt: observacion.createdAt,
      autor: observacion.user?.name,
      proyecto: observacion.proyecto?.detalle,
      proyectoId: observacion.proyectoId,
      respondeA: observacion.respuestaA
        ? { id: observacion.respuestaA.id, autor: observacion.respuestaA.user?.name, descripcion: observacion.respuestaA.descripcion }
        : null,
      tieneRespuestas,
      cantidadRespuestas: observacion.respuestas.length,
    },
    message: tieneRespuestas
      ? 'Esta observación tiene respuestas encadenadas — no se puede eliminar sin antes quitarlas.'
      : 'Vista previa cargada. Confirma para eliminar.',
  })
}
