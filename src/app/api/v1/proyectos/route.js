import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

const PROYECTO_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  estado: { select: { id: true, nombre: true, color: true } },
  clientes: { include: { cliente: { select: { id: true, nombre: true, apellido: true } } } },
  responsables: { include: { user: { select: { id: true, name: true, email: true } } } },
  facturas: { select: { valor: true, pagos: { select: { valor: true } } } },
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

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const estadoId = request.nextUrl.searchParams.get('estado_id')
  const where = estadoId && !isNaN(parseInt(estadoId)) ? { estadoId: parseInt(estadoId) } : {}

  const proyectos = await prisma.proyecto.findMany({
    where,
    include: PROYECTO_INCLUDE,
    orderBy: { fechaCreacion: 'desc' },
  })

  return NextResponse.json({ success: true, data: proyectos.map(calcularCampos), message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.PROYECTOS.CREAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear proyectos' }, { status: 403 })
  }

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
    const proyecto = await prisma.proyecto.create({
      data: {
        detalle: detalle.trim(),
        empresaId: parseInt(empresaId),
        valor: valor ? parseFloat(valor) : 0,
        fechaCreacion: new Date(fechaCreacion),
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        estadoId: parseInt(estadoId),
        projectOnline: projectOnline?.trim() || null,
        clientes: {
          create: clienteIds.map((id) => ({ clienteId: parseInt(id) })),
        },
        responsables: {
          create: responsableIds.map((id) => ({ userId: parseInt(id) })),
        },
      },
      include: PROYECTO_INCLUDE,
    })

    return NextResponse.json(
      { success: true, data: calcularCampos(proyecto), message: 'Proyecto creado exitosamente' },
      { status: 201 }
    )
  } catch (error) {
    if (error.code === 'P2003') {
      return NextResponse.json({ success: false, message: 'Empresa o estado no encontrado' }, { status: 422 })
    }
    throw error
  }
}
