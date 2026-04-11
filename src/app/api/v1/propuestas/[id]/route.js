import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

// Transiciones de estado permitidas
const TRANSICIONES = {
  Factibilidad: ['Haciendo'],
  Haciendo:     ['Enviada', 'Factibilidad'],
  Enviada:      ['Aprobada', 'Rechazada'],
  Aprobada:     [],
  Rechazada:    [],
}

const PROPUESTA_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  responsables: { include: { user: { select: { id: true, name: true } } } },
  proyecto: { select: { id: true, detalle: true, estadoId: true } },
  logs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
}

function serializePropuesta(p) {
  return { ...p, valorEstimado: p.valorEstimado ? Number(p.valorEstimado) : null }
}

// GET /api/v1/propuestas/:id
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await prisma.propuesta.findUnique({ where: { id }, include: PROPUESTA_INCLUDE })
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })

  return NextResponse.json({ success: true, data: serializePropuesta(propuesta), message: '' })
}

// PUT /api/v1/propuestas/:id — editar metadata (no estado)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PROPUESTAS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar propuestas' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const actual = await prisma.propuesta.findUnique({ where: { id }, select: { estado: true } })
  if (!actual) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })
  if (['Aprobada', 'Rechazada'].includes(actual.estado)) {
    return NextResponse.json({ success: false, message: 'No se puede editar una propuesta en estado terminal' }, { status: 422 })
  }

  const { titulo, descripcion, empresaId, valorEstimado, fechaCreacion, responsableIds = [] } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  // Sync responsables
  await prisma.propuestaResponsable.deleteMany({ where: { propuestaId: id } })

  const propuesta = await prisma.propuesta.update({
    where: { id },
    data: {
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      empresaId: parseInt(empresaId),
      valorEstimado: valorEstimado != null ? parseFloat(valorEstimado) : null,
      fechaCreacion: new Date(fechaCreacion),
      responsables: {
        create: responsableIds.map((uid) => ({ userId: parseInt(uid) })),
      },
    },
    include: PROPUESTA_INCLUDE,
  })

  return NextResponse.json({ success: true, data: serializePropuesta(propuesta), message: 'Propuesta actualizada exitosamente' })
}

// PATCH /api/v1/propuestas/:id — cambiar estado
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PROPUESTAS.CAMBIAR_ESTADO)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para cambiar el estado de propuestas' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { estadoNuevo, nota } = await request.json()
  if (!estadoNuevo) return NextResponse.json({ success: false, message: 'estadoNuevo es requerido' }, { status: 422 })

  const propuesta = await prisma.propuesta.findUnique({
    where: { id },
    include: { responsables: { select: { userId: true } } },
  })
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })

  // Validar transición
  const permitidos = TRANSICIONES[propuesta.estado] || []
  if (!permitidos.includes(estadoNuevo)) {
    return NextResponse.json({
      success: false,
      message: `Transición inválida: ${propuesta.estado} → ${estadoNuevo}. Permitidas: ${permitidos.join(', ') || 'ninguna'}`,
    }, { status: 422 })
  }

  const userId = parseInt(session.user.id)
  const estadoAnterior = propuesta.estado

  // ── Caso especial: APROBADA → crear Proyecto en transacción ──────────────
  if (estadoNuevo === 'Aprobada') {
    let proyectoCreado = null
    let propuestaActualizada = null

    await prisma.$transaction(async (tx) => {
      proyectoCreado = await tx.proyecto.create({
        data: {
          detalle: propuesta.titulo,
          empresaId: propuesta.empresaId,
          valor: propuesta.valorEstimado ?? 0,
          fechaCreacion: new Date(),
          estadoId: 3, // Adjudicado
          responsables: {
            create: propuesta.responsables.map((r) => ({ userId: r.userId })),
          },
        },
        select: { id: true, detalle: true },
      })

      propuestaActualizada = await tx.propuesta.update({
        where: { id },
        data: { estado: 'Aprobada', proyectoId: proyectoCreado.id },
        include: PROPUESTA_INCLUDE,
      })

      await tx.propuestaEstadoLog.create({
        data: {
          propuestaId: id,
          estadoAnterior,
          estadoNuevo: 'Aprobada',
          userId,
          nota: nota?.trim() || null,
        },
      })

      // Log inicial del proyecto creado en ProyectoEstadoLog
      await tx.proyectoEstadoLog.create({
        data: {
          proyectoId: proyectoCreado.id,
          estadoAnteriorId: null,
          estadoNuevoId: 3,
          userId,
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: serializePropuesta(propuestaActualizada),
      proyectoCreado,
      message: `Propuesta aprobada. Proyecto "${proyectoCreado.detalle}" creado automáticamente.`,
    })
  }

  // ── Cambio normal de estado ───────────────────────────────────────────────
  const dataUpdate = { estado: estadoNuevo }
  if (estadoNuevo === 'Enviada' && !propuesta.fechaEnvio) {
    dataUpdate.fechaEnvio = new Date()
  }

  const [propuestaActualizada] = await prisma.$transaction([
    prisma.propuesta.update({
      where: { id },
      data: dataUpdate,
      include: PROPUESTA_INCLUDE,
    }),
    prisma.propuestaEstadoLog.create({
      data: {
        propuestaId: id,
        estadoAnterior,
        estadoNuevo,
        userId,
        nota: nota?.trim() || null,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: serializePropuesta(propuestaActualizada),
    proyectoCreado: null,
    message: `Estado actualizado a ${estadoNuevo}`,
  })
}

// DELETE /api/v1/propuestas/:id
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PROPUESTAS.ELIMINAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para eliminar propuestas' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await prisma.propuesta.findUnique({ where: { id }, select: { estado: true, titulo: true } })
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })

  if (!['Factibilidad', 'Haciendo'].includes(propuesta.estado)) {
    return NextResponse.json({
      success: false,
      message: `No se puede eliminar una propuesta en estado "${propuesta.estado}". Solo es posible en Factibilidad o Haciendo.`,
    }, { status: 422 })
  }

  await prisma.propuesta.delete({ where: { id } })
  return NextResponse.json({ success: true, data: null, message: 'Propuesta eliminada exitosamente' })
}
