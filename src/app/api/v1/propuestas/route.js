import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

const PROPUESTA_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  responsables: { include: { user: { select: { id: true, name: true } } } },
  _count: { select: { logs: true } },
}

// GET /api/v1/propuestas?estado=&empresa_id=
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

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

  const { titulo, descripcion, empresaId, valorEstimado, fechaCreacion, aplicativo, responsableIds = [] } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const anio = new Date().getFullYear()
  const countAnio = await prisma.propuesta.count({ where: { codigo: { startsWith: `PROP-${anio}-` } } })
  const codigo = `PROP-${anio}-${String(countAnio + 1).padStart(3, '0')}`

  const propuesta = await prisma.propuesta.create({
    data: {
      codigo,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      empresaId: parseInt(empresaId),
      valorEstimado: valorEstimado ? parseFloat(valorEstimado) : null,
      fechaCreacion: new Date(fechaCreacion),
      aplicativo: aplicativo?.trim() || null,
      estado: 'Factibilidad',
      responsables: {
        create: responsableIds.map((uid) => ({ userId: parseInt(uid) })),
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
}
