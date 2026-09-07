import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { logPermisoDenegado } from '@/lib/logger'

const OPORTUNIDAD_INCLUDE = {
  responsable: { select: { id: true, nombre: true, apellido: true } },
  contactos: true,
  propuesta: { select: { id: true, codigo: true, estado: true } },
  seguimientos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
}

const serializeOportunidad = (o) => ({
  ...o,
  valorEstimado: o.valorEstimado != null ? Number(o.valorEstimado) : null,
  ultimoSeguimiento: o.seguimientos?.[0]?.createdAt ?? null,
  seguimientos: undefined,
})

// GET /api/v1/oportunidades?etapa=&responsable_id=
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, 'GET /oportunidades')
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const etapa = searchParams.get('etapa')
  const responsableId = searchParams.get('responsable_id')

  const where = {}
  if (etapa) where.etapa = etapa
  if (responsableId && !isNaN(parseInt(responsableId))) where.responsableId = parseInt(responsableId)

  const oportunidades = await prisma.oportunidad.findMany({
    where,
    include: OPORTUNIDAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: oportunidades.map(serializeOportunidad), message: '' })
}

// POST /api/v1/oportunidades
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.CREAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.CREAR, 'POST /oportunidades')
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear oportunidades' }, { status: 403 })
  }

  const {
    titulo, empresaNombre, origen, descripcion, valorEstimado,
    responsableId, fechaCreacion, contactos = [],
  } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaNombre?.trim()) errors.empresaNombre = ['La empresa es requerida']
  if (!responsableId) errors.responsableId = ['El responsable es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const userId = parseInt(session.user.id)

  try {
    const oportunidad = await prisma.oportunidad.create({
      data: {
        titulo: titulo.trim(),
        empresaNombre: empresaNombre.trim(),
        origen: origen?.trim() || null,
        descripcion: descripcion?.trim() || null,
        valorEstimado: valorEstimado != null ? parseFloat(valorEstimado) : null,
        responsableId: parseInt(responsableId),
        fechaCreacion: new Date(fechaCreacion),
        etapa: 'Prospeccion',
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
        logs: {
          create: {
            etapaAnterior: null,
            etapaNueva: 'Prospeccion',
            userId,
            nota: 'Oportunidad creada',
          },
        },
      },
      include: OPORTUNIDAD_INCLUDE,
    })

    return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: 'Oportunidad creada exitosamente' }, { status: 201 })
  } catch (e) {
    if (e.code === 'P2003') return NextResponse.json({ success: false, message: 'El responsable indicado no existe' }, { status: 422 })
    console.error('POST /oportunidades error:', e.message)
    return NextResponse.json({ success: false, message: 'Error interno al crear la oportunidad' }, { status: 500 })
  }
}
