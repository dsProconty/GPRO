import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Estados terminales: caso de negocio bloqueado (RN-CN04)
const ESTADOS_BLOQUEADOS = ['Aprobada', 'Rechazada']

async function getPropuesta(id) {
  return prisma.propuesta.findUnique({
    where: { id },
    select: { id: true, estado: true },
  })
}

// GET /api/v1/propuestas/:id/caso-negocio
// Devuelve las líneas con perfil incluido + resumen calculado
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const lineas = await prisma.casoNegocioLinea.findMany({
    where: { propuestaId },
    include: { perfil: true },
    orderBy: { perfil: { nombre: 'asc' } },
  })

  // Calcular resumen en tiempo real (RN-CN02)
  const lineasCalculadas = lineas.map((l) => ({
    propuestaId:  l.propuestaId,
    perfilId:     l.perfilId,
    horas:        Number(l.horas),
    perfil:       l.perfil,
    costo:        Number(l.horas) * Number(l.perfil.costoHora),
    precio:       Number(l.horas) * Number(l.perfil.precioHora),
  }))

  const totalHoras  = lineasCalculadas.reduce((s, l) => s + l.horas,  0)
  const totalCosto  = lineasCalculadas.reduce((s, l) => s + l.costo,  0)
  const totalPrecio = lineasCalculadas.reduce((s, l) => s + l.precio, 0)
  const gm          = totalPrecio - totalCosto
  const gmPct       = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0

  return NextResponse.json({
    success: true,
    data: {
      lineas: lineasCalculadas,
      resumen: { totalHoras, totalCosto, totalPrecio, gm, gmPct },
    },
  })
}

// POST /api/v1/propuestas/:id/caso-negocio
// Agrega o actualiza una línea (upsert por propuestaId + perfilId)
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })
  if (ESTADOS_BLOQUEADOS.includes(propuesta.estado)) {
    return NextResponse.json({ success: false, message: 'El caso de negocio no se puede editar en el estado actual' }, { status: 409 })
  }

  const { perfilId, horas } = await request.json()

  if (!perfilId) return NextResponse.json({ success: false, message: 'perfilId es requerido' }, { status: 422 })
  if (!horas || Number(horas) <= 0) return NextResponse.json({ success: false, message: 'Las horas deben ser mayores a 0' }, { status: 422 })

  const perfil = await prisma.perfilConsultor.findUnique({ where: { id: Number(perfilId) } })
  if (!perfil) return NextResponse.json({ success: false, message: 'Perfil no encontrado' }, { status: 404 })
  if (!perfil.activo) return NextResponse.json({ success: false, message: 'Este perfil está inactivo' }, { status: 409 })

  const linea = await prisma.casoNegocioLinea.upsert({
    where:  { propuestaId_perfilId: { propuestaId, perfilId: Number(perfilId) } },
    update: { horas: Number(horas) },
    create: { propuestaId, perfilId: Number(perfilId), horas: Number(horas) },
    include: { perfil: true },
  })

  return NextResponse.json({ success: true, data: linea, message: 'Línea guardada' }, { status: 201 })
}

// DELETE /api/v1/propuestas/:id/caso-negocio?perfilId=X
// Elimina una línea específica
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })
  if (ESTADOS_BLOQUEADOS.includes(propuesta.estado)) {
    return NextResponse.json({ success: false, message: 'El caso de negocio no se puede editar en el estado actual' }, { status: 409 })
  }

  const { searchParams } = new URL(request.url)
  const perfilId = parseInt(searchParams.get('perfilId'))
  if (isNaN(perfilId)) return NextResponse.json({ success: false, message: 'perfilId inválido' }, { status: 400 })

  await prisma.casoNegocioLinea.delete({
    where: { propuestaId_perfilId: { propuestaId, perfilId } },
  })

  return NextResponse.json({ success: true, message: 'Línea eliminada' })
}
