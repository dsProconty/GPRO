import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

function calcResumen(lineas) {
  const totalHoras  = lineas.reduce((s, l) => s + Number(l.horas), 0)
  const totalCosto  = lineas.reduce((s, l) => s + Number(l.horas) * Number(l.costoHora), 0)
  const totalPrecio = lineas.reduce((s, l) => s + Number(l.horas) * Number(l.precioHora), 0)
  const gm          = totalPrecio - totalCosto
  const gmPct       = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
  return { totalHoras, totalCosto, totalPrecio, gm, gmPct }
}

function serializeLineas(lineas) {
  return lineas.map((l) => ({
    perfilConsultorId: l.perfilConsultorId,
    perfil: l.perfilConsultor,
    horas:      Number(l.horas),
    costoHora:  Number(l.costoHora),
    precioHora: Number(l.precioHora),
    costo:      Number(l.horas) * Number(l.costoHora),
    precio:     Number(l.horas) * Number(l.precioHora),
    gm:         Number(l.horas) * (Number(l.precioHora) - Number(l.costoHora)),
    gmPct:      Number(l.precioHora) > 0
      ? Math.round(((Number(l.precioHora) - Number(l.costoHora)) / Number(l.precioHora)) * 100)
      : 0,
  }))
}

// GET /api/v1/proyectos/:id/caso-negocio
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const proyectoId = parseInt(params.id)
  if (isNaN(proyectoId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const lineas = await prisma.proyectoCasoNegocioLinea.findMany({
    where: { proyectoId },
    include: { perfilConsultor: true },
    orderBy: { perfilConsultor: { nombre: 'asc' } },
  })

  const serialized = serializeLineas(lineas)
  return NextResponse.json({
    success: true,
    data: { lineas: serialized, resumen: calcResumen(lineas) },
    message: '',
  })
}

// POST /api/v1/proyectos/:id/caso-negocio — upsert línea
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar el caso de negocio' }, { status: 403 })
  }

  const proyectoId = parseInt(params.id)
  if (isNaN(proyectoId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { perfilId, horas } = await request.json()
  if (!perfilId) return NextResponse.json({ success: false, message: 'perfilId es requerido' }, { status: 422 })
  if (!horas || Number(horas) <= 0) return NextResponse.json({ success: false, message: 'horas debe ser mayor a 0' }, { status: 422 })

  const perfil = await prisma.perfilConsultor.findFirst({ where: { id: parseInt(perfilId), activo: true } })
  if (!perfil) return NextResponse.json({ success: false, message: 'Perfil no encontrado o inactivo' }, { status: 422 })

  await prisma.proyectoCasoNegocioLinea.upsert({
    where: { proyectoId_perfilConsultorId: { proyectoId, perfilConsultorId: perfil.id } },
    update: { horas: parseFloat(horas), costoHora: perfil.costoHora, precioHora: perfil.precioHora },
    create: { proyectoId, perfilConsultorId: perfil.id, horas: parseFloat(horas), costoHora: perfil.costoHora, precioHora: perfil.precioHora },
  })

  const lineas = await prisma.proyectoCasoNegocioLinea.findMany({
    where: { proyectoId },
    include: { perfilConsultor: true },
    orderBy: { perfilConsultor: { nombre: 'asc' } },
  })

  return NextResponse.json({
    success: true,
    data: { lineas: serializeLineas(lineas), resumen: calcResumen(lineas) },
    message: 'Línea guardada',
  })
}

// DELETE /api/v1/proyectos/:id/caso-negocio?perfilId=X
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar el caso de negocio' }, { status: 403 })
  }

  const proyectoId = parseInt(params.id)
  const perfilId   = parseInt(request.nextUrl.searchParams.get('perfilId') || '')
  if (isNaN(proyectoId) || isNaN(perfilId)) return NextResponse.json({ success: false, message: 'IDs inválidos' }, { status: 400 })

  await prisma.proyectoCasoNegocioLinea.deleteMany({
    where: { proyectoId, perfilConsultorId: perfilId },
  })

  const lineas = await prisma.proyectoCasoNegocioLinea.findMany({
    where: { proyectoId },
    include: { perfilConsultor: true },
    orderBy: { perfilConsultor: { nombre: 'asc' } },
  })

  return NextResponse.json({
    success: true,
    data: { lineas: serializeLineas(lineas), resumen: calcResumen(lineas) },
    message: 'Línea eliminada',
  })
}
