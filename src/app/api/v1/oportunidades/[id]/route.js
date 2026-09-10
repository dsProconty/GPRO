import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { generarCodigoPropuesta } from '@/lib/codigoHelper'
import { TRANSICIONES, ETAPA_HOOK } from '@/lib/oportunidades'
import { logger, logPermisoDenegado } from '@/lib/logger'

const OPORTUNIDAD_INCLUDE = {
  responsable: { select: { id: true, nombre: true, apellido: true } },
  contactos: true,
  propuesta: { select: { id: true, codigo: true, estado: true } },
  logs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
  seguimientos: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
}

function serializeOportunidad(o) {
  return { ...o, valorEstimado: o.valorEstimado != null ? Number(o.valorEstimado) : null }
}

// GET /api/v1/oportunidades/:id
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, `GET /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id }, include: OPORTUNIDAD_INCLUDE })
  if (!oportunidad) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: '' })
}

// PUT /api/v1/oportunidades/:id — editar metadata (RN-O08: bloqueado si ya tiene propuestaId)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.EDITAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.EDITAR, `PUT /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const actual = await prisma.oportunidad.findUnique({ where: { id }, select: { propuestaId: true } })
  if (!actual) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })
  if (actual.propuestaId) {
    return NextResponse.json({ success: false, message: 'No se puede editar: esta oportunidad ya generó una propuesta' }, { status: 422 })
  }

  const { titulo, empresaNombre, origen, descripcion, valorEstimado, responsableId, fechaCreacion, contactos = [] } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaNombre?.trim()) errors.empresaNombre = ['La empresa es requerida']
  if (!responsableId) errors.responsableId = ['El responsable es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  await prisma.oportunidadContacto.deleteMany({ where: { oportunidadId: id } })

  const oportunidad = await prisma.oportunidad.update({
    where: { id },
    data: {
      titulo: titulo.trim(),
      empresaNombre: empresaNombre.trim(),
      origen: origen?.trim() || null,
      descripcion: descripcion?.trim() || null,
      valorEstimado: valorEstimado != null ? parseFloat(valorEstimado) : null,
      responsableId: parseInt(responsableId),
      fechaCreacion: new Date(fechaCreacion),
      contactos: {
        create: contactos
          .filter((c) => c.nombre?.trim())
          .map((c) => ({
            nombre: c.nombre.trim(),
            cargo: c.cargo?.trim() || null,
            telefono: c.telefono?.trim() || null,
            correo: c.correo?.trim() || null,
          })),
      },
    },
    include: OPORTUNIDAD_INCLUDE,
  })

  return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: 'Oportunidad actualizada exitosamente' })
}

// PATCH /api/v1/oportunidades/:id — cambiar etapa (RN-O02, RN-O04, RN-O05)
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.CAMBIAR_ETAPA)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.CAMBIAR_ETAPA, `PATCH /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para cambiar la etapa de oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { etapaNueva, nota, motivoPerdida, empresaId } = await request.json()
  if (!etapaNueva) return NextResponse.json({ success: false, message: 'etapaNueva es requerida' }, { status: 422 })

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id } })
  if (!oportunidad) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  const permitidas = TRANSICIONES[oportunidad.etapa] || []
  if (!permitidas.includes(etapaNueva)) {
    return NextResponse.json({
      success: false,
      message: `Transición inválida: ${oportunidad.etapa} → ${etapaNueva}. Permitidas: ${permitidas.join(', ') || 'ninguna'}`,
    }, { status: 422 })
  }

  if (etapaNueva === ETAPA_HOOK && empresaId) {
    const empresaExiste = await prisma.empresa.findUnique({ where: { id: parseInt(empresaId) }, select: { id: true } })
    if (!empresaExiste) return NextResponse.json({ success: false, message: 'El cliente seleccionado no existe' }, { status: 422 })
  }

  const userId = parseInt(session.user.id)
  const etapaAnterior = oportunidad.etapa

  // ── RN-O04: gancho a Propuesta ───────────────────────────────────────────
  if (etapaNueva === ETAPA_HOOK) {
    let propuestaCreada = null
    let oportunidadActualizada = null

    await prisma.$transaction(async (tx) => {
      const empresa = empresaId
        ? await tx.empresa.findUnique({ where: { id: parseInt(empresaId) } })
        : await tx.empresa.create({ data: { nombre: oportunidad.empresaNombre } })

      const codigo = await generarCodigoPropuesta(empresa.id, new Date(), tx)

      propuestaCreada = await tx.propuesta.create({
        data: {
          codigo,
          titulo: oportunidad.titulo,
          descripcion: oportunidad.descripcion,
          empresaId: empresa.id,
          valorEstimado: oportunidad.valorEstimado,
          fechaCreacion: new Date(),
          estado: 'Factibilidad',
          logs: { create: { estadoAnterior: null, estadoNuevo: 'Factibilidad', userId, nota: `Generada automáticamente desde la oportunidad "${oportunidad.titulo}"` } },
        },
        select: { id: true, codigo: true, titulo: true, estado: true },
      })

      oportunidadActualizada = await tx.oportunidad.update({
        where: { id },
        data: { etapa: etapaNueva, propuestaId: propuestaCreada.id },
        include: OPORTUNIDAD_INCLUDE,
      })

      await tx.oportunidadEstadoLog.create({
        data: {
          oportunidadId: id,
          etapaAnterior,
          etapaNueva,
          userId,
          nota: nota?.trim() || `Cliente solicitó formalmente una propuesta. Se generó automáticamente ${propuestaCreada.codigo} en estado Factibilidad.`,
        },
      })
    })

    logger.info('OPORTUNIDAD_CONVERTIDA', { oportunidadId: id, propuestaId: propuestaCreada.id, userId, userName: session.user.name })

    return NextResponse.json({
      success: true,
      data: serializeOportunidad(oportunidadActualizada),
      propuestaCreada,
      message: `Oportunidad convertida. Propuesta "${propuestaCreada.codigo}" generada automáticamente.`,
    })
  }

  // ── Cambio normal de etapa ────────────────────────────────────────────────
  const dataUpdate = { etapa: etapaNueva }
  if (etapaNueva === 'Perdida') dataUpdate.motivoPerdida = motivoPerdida?.trim() || null
  else if (etapaAnterior === 'Perdida') dataUpdate.motivoPerdida = null // reactivación limpia el motivo

  const [oportunidadActualizada] = await prisma.$transaction([
    prisma.oportunidad.update({ where: { id }, data: dataUpdate, include: OPORTUNIDAD_INCLUDE }),
    prisma.oportunidadEstadoLog.create({
      data: { oportunidadId: id, etapaAnterior, etapaNueva, userId, nota: nota?.trim() || null },
    }),
  ])

  logger.info('OPORTUNIDAD_ETAPA_CAMBIADA', { oportunidadId: id, etapaAnterior, etapaNueva, userId, userName: session.user.name })

  return NextResponse.json({
    success: true,
    data: serializeOportunidad(oportunidadActualizada),
    propuestaCreada: null,
    message: `Etapa actualizada a ${etapaNueva}`,
  })
}

// DELETE /api/v1/oportunidades/:id (RN-O03)
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.ELIMINAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.ELIMINAR, `DELETE /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para eliminar oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id }, select: { etapa: true, titulo: true } })
  if (!oportunidad) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  if (!['Prospeccion', 'Solicitud_RFI', 'Entrega_RFI'].includes(oportunidad.etapa)) {
    return NextResponse.json({
      success: false,
      message: `No se puede eliminar una oportunidad en etapa "${oportunidad.etapa}".`,
    }, { status: 422 })
  }

  await prisma.oportunidad.delete({ where: { id } })
  return NextResponse.json({ success: true, data: null, message: 'Oportunidad eliminada exitosamente' })
}
