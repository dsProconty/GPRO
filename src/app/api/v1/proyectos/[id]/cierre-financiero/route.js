import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { logger, logPermisoDenegado } from '@/lib/logger'

// PATCH /api/v1/proyectos/:id/cierre-financiero
// Body: { fecha: 'YYYY-MM-DD' | null }
// fecha truthy  -> cierra financieramente el proyecto (fechaCierreFinanciero = fecha)
// fecha null    -> reabre el cierre financiero (fechaCierreFinanciero = null)
// Si el proyecto tiene saldo pendiente (facturado - pagado > 0), solo un usuario
// con el permiso proyectos.cerrarFinanciero puede forzar el cierre o reabrirlo.
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PROYECTOS.EDITAR)) {
    logPermisoDenegado(session, PERMISOS.PROYECTOS.EDITAR, `PATCH /proyectos/${params.id}/cierre-financiero`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar proyectos' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { fecha } = await request.json()

  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { facturas: { select: { valor: true, pagos: { select: { valor: true } } } } },
  })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })

  const facturado = proyecto.facturas.reduce((s, f) => s + Number(f.valor), 0)
  const pagado = proyecto.facturas.reduce((s, f) => s + f.pagos.reduce((sp, p) => sp + Number(p.valor), 0), 0)
  const saldo = facturado - pagado

  // Un proyecto sin nada facturado no puede cerrarse financieramente
  // (saldo=0 por defecto no cuenta como "cobrado")
  if (fecha && facturado <= 0.001) {
    return NextResponse.json({
      success: false,
      message: 'El proyecto no tiene facturas registradas, no se puede cerrar financieramente.',
    }, { status: 422 })
  }

  if (saldo > 0.001 && !tienePermiso(session, PERMISOS.PROYECTOS.CERRAR_FINANCIERO)) {
    logPermisoDenegado(session, PERMISOS.PROYECTOS.CERRAR_FINANCIERO, `PATCH /proyectos/${id}/cierre-financiero (saldo pendiente)`)
    return NextResponse.json({
      success: false,
      message: 'El proyecto tiene saldo pendiente de cobro. Solo un usuario con permiso de cierre financiero forzado puede hacer esto.',
    }, { status: 403 })
  }

  const updated = await prisma.proyecto.update({
    where: { id },
    data: { fechaCierreFinanciero: fecha ? new Date(fecha) : null },
    select: { id: true, fechaCierreFinanciero: true },
  })

  logger.info('PROYECTO_CIERRE_FINANCIERO', {
    proyectoId: id,
    fechaCierreFinanciero: updated.fechaCierreFinanciero,
    saldo,
    userId: session.user.id,
    userName: session.user.name,
  })

  return NextResponse.json({
    success: true,
    data: updated,
    message: fecha ? 'Proyecto cerrado financieramente' : 'Cierre financiero revertido',
  })
}
