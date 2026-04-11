import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PROYECTO_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  estado: { select: { id: true, nombre: true, color: true } },
  clientes: { include: { cliente: { select: { id: true, nombre: true, apellido: true } } } },
  responsables: { include: { user: { select: { id: true, name: true, email: true } } } },
  facturas: { select: { valor: true, pagos: { select: { valor: true } } } },
  propuesta: { select: { id: true, titulo: true } },
}

function calcularCampos(proyecto) {
  const facturado = proyecto.facturas.reduce((sum, f) => sum + Number(f.valor), 0)
  const pagado = proyecto.facturas.reduce(
    (sum, f) => sum + f.pagos.reduce((s, p) => s + Number(p.valor), 0),
    0
  )
  const saldo = facturado - pagado
  const fin = proyecto.fechaCierre ? new Date(proyecto.fechaCierre) : new Date()
  const inicio = new Date(proyecto.fechaCreacion)
  const tiempoVida = Math.max(0, Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)))

  return {
    ...proyecto,
    valor: Number(proyecto.valor),
    facturado,
    pagado,
    saldo,
    tiempoVida,
    clienteIds: proyecto.clientes.map((c) => c.clienteId),
    responsableIds: proyecto.responsables.map((r) => r.userId),
  }
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const proyecto = await prisma.proyecto.findUnique({ where: { id }, include: PROYECTO_INCLUDE })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })

  return NextResponse.json({ success: true, data: calcularCampos(proyecto), message: '' })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { detalle, empresaId, valor, fechaCreacion, fechaCierre, estadoId, projectOnline, clienteIds = [], responsableIds = [] } = await request.json()

  const errors = {}
  if (!detalle?.trim()) errors.detalle = ['El detalle es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (!estadoId) errors.estadoId = ['El estado es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de inicio es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  try {
    // Sync pivots: deleteMany + createMany
    await prisma.proyectoCliente.deleteMany({ where: { proyectoId: id } })
    await prisma.proyectoResponsable.deleteMany({ where: { proyectoId: id } })

    const proyecto = await prisma.proyecto.update({
      where: { id },
      data: {
        detalle: detalle.trim(),
        empresaId: parseInt(empresaId),
        valor: valor ? parseFloat(valor) : 0,
        fechaCreacion: new Date(fechaCreacion),
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        estadoId: parseInt(estadoId),
        projectOnline: projectOnline?.trim() || null,
        clientes: {
          create: clienteIds.map((cid) => ({ clienteId: parseInt(cid) })),
        },
        responsables: {
          create: responsableIds.map((uid) => ({ userId: parseInt(uid) })),
        },
      },
      include: PROYECTO_INCLUDE,
    })

    return NextResponse.json({ success: true, data: calcularCampos(proyecto), message: 'Proyecto actualizado exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })
    }
    throw error
  }
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { estadoId } = await request.json()
  if (!estadoId) return NextResponse.json({ success: false, message: 'estadoId requerido' }, { status: 422 })

  // RN-05: warning (no bloqueante) si se cierra con saldo pendiente
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { facturas: { select: { valor: true, pagos: { select: { valor: true } } } } },
  })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })

  const estado = await prisma.estado.findUnique({ where: { id: parseInt(estadoId) } })
  let warning = null
  if (estado?.nombre === 'Cerrado') {
    const facturado = proyecto.facturas.reduce((s, f) => s + Number(f.valor), 0)
    const pagado = proyecto.facturas.reduce((s, f) => s + f.pagos.reduce((sp, p) => sp + Number(p.valor), 0), 0)
    if (facturado - pagado > 0.001) {
      warning = 'El proyecto tiene saldo pendiente de cobro.'
    }
  }

  try {
    const [updated] = await prisma.$transaction([
      prisma.proyecto.update({
        where: { id },
        data: { estadoId: parseInt(estadoId) },
        include: PROYECTO_INCLUDE,
      }),
      prisma.proyectoEstadoLog.create({
        data: {
          proyectoId: id,
          estadoAnteriorId: proyecto.estadoId,
          estadoNuevoId: parseInt(estadoId),
          userId: parseInt(session.user.id),
        },
      }),
    ])
    return NextResponse.json({ success: true, data: calcularCampos(updated), message: 'Estado actualizado', warning })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })
    throw e
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const facturasCount = await prisma.factura.count({ where: { proyectoId: id } })
  if (facturasCount > 0) {
    return NextResponse.json(
      { success: false, message: 'No se puede eliminar: el proyecto tiene facturas asociadas' },
      { status: 422 }
    )
  }

  try {
    await prisma.proyecto.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Proyecto eliminado exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })
    }
    throw error
  }
}
