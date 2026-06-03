import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { generarCodigoPropuesta } from '@/lib/codigoHelper'

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
    data: propuestas.map((p) => ({
      ...p,
      valorEstimado: p.valorEstimado ? Number(p.valorEstimado) : null,
    })),
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

  const { titulo, descripcion, empresaId, valorEstimado, fechaCreacion, aplicativo, responsableIds = [], clienteIds = [], tipoPropuesta = 'PorHoras' } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  try {
    const codigo = await generarCodigoPropuesta(parseInt(empresaId), new Date(fechaCreacion), prisma)

    const propuesta = await prisma.propuesta.create({
      data: {
        codigo,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        empresaId: parseInt(empresaId),
        valorEstimado: valorEstimado ? parseFloat(valorEstimado) : null,
        fechaCreacion: new Date(fechaCreacion),
        aplicativo: aplicativo?.trim() || null,
        tipoPropuesta: ['PorHoras', 'Mensualizada'].includes(tipoPropuesta) ? tipoPropuesta : 'PorHoras',
        estado: 'Factibilidad',
        responsables: {
          create: responsableIds.map((eid) => ({ empleadoId: parseInt(eid) })),
        },
        clientes: {
          create: clienteIds.map((cid) => ({ clienteId: parseInt(cid) })),
        },
        logs: {
          create: {
            estadoAnterior: null,
            estadoNuevo: 'Factibilidad',
            userId: parseInt(session.user.id),
            nota: 'Propuesta creada',
          },
        },
      },
      include: PROPUESTA_INCLUDE,
    })

    return NextResponse.json({
      success: true,
      data: { ...propuesta, valorEstimado: propuesta.valorEstimado ? Number(propuesta.valorEstimado) : null },
      message: 'Propuesta creada exitosamente',
    }, { status: 201 })
  } catch (e) {
    if (e.code === 'P2003') return NextResponse.json({ success: false, message: 'La empresa o responsable indicado no existe' }, { status: 422 })
    console.error('POST /propuestas error:', e.message)
    return NextResponse.json({ success: false, message: 'Error interno al crear la propuesta' }, { status: 500 })
  }
}
