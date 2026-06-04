import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { generarCodigoPropuesta, generarCodigoProyecto } from '@/lib/codigoHelper'

const serializePropuesta = (p) => ({
  ...p,
  valorEstimado: p.valorEstimado ? Number(p.valorEstimado) : null,
  valorMensual:  p.valorMensual  ? Number(p.valorMensual)  : null,
})

const PROPUESTA_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  responsables: { include: { empleado: { select: { id: true, nombre: true, apellido: true } } } },
  clientes: { include: { cliente: { select: { id: true, nombre: true, apellido: true } } } },
  _count: { select: { logs: true } },
}

// GET /api/v1/propuestas?estado=&empresa_id=
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PROPUESTAS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para ver propuestas' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const empresaId = searchParams.get('empresa_id')

  const where = {}
  if (estado) where.estado = estado
  if (empresaId && !isNaN(parseInt(empresaId))) where.empresaId = parseInt(empresaId)

  const propuestas = await prisma.propuesta.findMany({
    where,
    include: PROPUESTA_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    success: true,
    data: propuestas.map(serializePropuesta),
    message: '',
  })
}

// POST /api/v1/propuestas
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PROPUESTAS.CREAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear propuestas' }, { status: 403 })
  }

  const { titulo, descripcion, empresaId, valorEstimado, valorMensual, mesesContrato, fechaCreacion, aplicativo, responsableIds = [], clienteIds = [], tipoPropuesta = 'PorHoras', estado = 'Factibilidad' } = await request.json()

  const ESTADOS_VALIDOS = ['Factibilidad', 'Haciendo', 'Enviada', 'Aprobada', 'Rechazada']

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']
  if (!ESTADOS_VALIDOS.includes(estado)) errors.estado = ['Estado inválido']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  try {
    const codigo = await generarCodigoPropuesta(parseInt(empresaId), new Date(fechaCreacion), prisma)

    const tipoValido = ['PorHoras', 'Mensualizada'].includes(tipoPropuesta) ? tipoPropuesta : 'PorHoras'
    const vMensual = valorMensual ? parseFloat(valorMensual) : null
    const meses    = mesesContrato ? parseInt(mesesContrato) : null
    const vEstimado = tipoValido === 'Mensualizada' && vMensual && meses
      ? vMensual * meses
      : (valorEstimado ? parseFloat(valorEstimado) : null)

    const userId = parseInt(session.user.id)
    const eid    = parseInt(empresaId)

    // Datos base de la propuesta
    const propuestaData = {
      codigo,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      empresaId: eid,
      valorEstimado: vEstimado,
      valorMensual:  vMensual,
      mesesContrato: meses,
      fechaCreacion: new Date(fechaCreacion),
      ...(estado === 'Enviada' || estado === 'Aprobada' ? { fechaEnvio: new Date() } : {}),
      aplicativo: aplicativo?.trim() || null,
      tipoPropuesta: tipoValido,
      estado,
      responsables: { create: responsableIds.map((rid) => ({ empleadoId: parseInt(rid) })) },
      clientes:     { create: clienteIds.map((cid)     => ({ clienteId:  parseInt(cid) })) },
      logs: {
        create: {
          estadoAnterior: null,
          estadoNuevo: estado,
          userId,
          nota: 'Propuesta creada',
        },
      },
    }

    // ── Caso especial: crear en estado Aprobada → crear Proyecto en la misma transacción ──
    if (estado === 'Aprobada') {
      const codigoProyecto = await generarCodigoProyecto(eid, new Date(), prisma)

      let propuestaCreada = null
      let proyectoCreado  = null

      await prisma.$transaction(async (tx) => {
        proyectoCreado = await tx.proyecto.create({
          data: {
            codigo:        codigoProyecto,
            detalle:       titulo.trim(),
            empresaId:     eid,
            valor:         vEstimado ?? 0,
            valorMensual:  vMensual  ?? null,
            mesesContrato: meses     ?? null,
            fechaCreacion: new Date(),
            estadoId:      3,
            aplicativo:    aplicativo?.trim() || null,
            responsables:  { create: responsableIds.map((rid) => ({ empleadoId: parseInt(rid) })) },
          },
          select: { id: true, detalle: true },
        })

        propuestaCreada = await tx.propuesta.create({
          data: { ...propuestaData, proyectoId: proyectoCreado.id },
          include: PROPUESTA_INCLUDE,
        })

        await tx.proyectoEstadoLog.create({
          data: {
            proyectoId:       proyectoCreado.id,
            estadoAnteriorId: null,
            estadoNuevoId:    3,
            userId,
          },
        })
      })

      return NextResponse.json({
        success: true,
        data: serializePropuesta(propuestaCreada),
        proyectoCreado,
        message: `Propuesta creada y aprobada. Proyecto "${proyectoCreado.detalle}" generado automáticamente.`,
      }, { status: 201 })
    }

    // ── Creación normal ──────────────────────────────────────────────────────
    const propuesta = await prisma.propuesta.create({
      data: propuestaData,
      include: PROPUESTA_INCLUDE,
    })

    return NextResponse.json({
      success: true,
      data: serializePropuesta(propuesta),
      proyectoCreado: null,
      message: 'Propuesta creada exitosamente',
    }, { status: 201 })
  } catch (e) {
    if (e.code === 'P2003') return NextResponse.json({ success: false, message: 'La empresa o responsable indicado no existe' }, { status: 422 })
    console.error('POST /propuestas error:', e.message)
    return NextResponse.json({ success: false, message: 'Error interno al crear la propuesta' }, { status: 500 })
  }
}
