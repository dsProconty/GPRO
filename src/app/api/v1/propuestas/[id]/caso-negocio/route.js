import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Estados terminales: caso de negocio bloqueado (RN-CN04)
const ESTADOS_BLOQUEADOS = ['Aprobada', 'Rechazada']

async function getPropuesta(id) {
  return prisma.propuesta.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      empresa: {
        select: { id: true, tarifarioId: true, tarifario: { select: { id: true, nombre: true } } },
      },
    },
  })
}

// GET /api/v1/propuestas/:id/caso-negocio
// Devuelve las líneas con perfil + empleado + resumen calculado
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)

  const lineas = await prisma.casoNegocioLinea.findMany({
    where: { propuestaId },
    include: {
      perfil:   true,
      empleado: { select: { id: true, nombre: true, apellido: true, costoHora: true } },
    },
    orderBy: { perfil: { nombre: 'asc' } },
  })

  // Calcular resumen en tiempo real (RN-CN02)
  // precioHora: usa el override de la línea si existe, si no usa el del perfil
  const lineasCalculadas = lineas.map((l) => {
    const precioHora = l.precioHora !== null ? Number(l.precioHora) : Number(l.perfil.precioHora)
    const costoHora  = l.empleado   ? Number(l.empleado.costoHora)  : Number(l.perfil.costoHora)
    return {
      propuestaId:  l.propuestaId,
      perfilId:     l.perfilId,
      empleadoId:   l.empleadoId,
      horas:        Number(l.horas),
      perfil:       l.perfil,
      empleado:     l.empleado,
      costoHora,
      precioHora,
      costo:        Number(l.horas) * costoHora,
      precio:       Number(l.horas) * precioHora,
    }
  })

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
      tarifario: propuesta?.empresa?.tarifario || null,
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

  const { perfilId, horas, empleadoId, precioHora } = await request.json()

  if (!perfilId) return NextResponse.json({ success: false, message: 'perfilId es requerido' }, { status: 422 })
  if (!horas || Number(horas) <= 0) return NextResponse.json({ success: false, message: 'Las horas deben ser mayores a 0' }, { status: 422 })

  const perfil = await prisma.perfilConsultor.findUnique({ where: { id: Number(perfilId) } })
  if (!perfil) return NextResponse.json({ success: false, message: 'Perfil no encontrado' }, { status: 404 })
  if (!perfil.activo) return NextResponse.json({ success: false, message: 'Este perfil está inactivo' }, { status: 409 })

  const updateData = {
    horas:      Number(horas),
    empleadoId: empleadoId ? Number(empleadoId) : null,
    precioHora: precioHora !== undefined && precioHora !== null ? Number(precioHora) : null,
  }

  const linea = await prisma.casoNegocioLinea.upsert({
    where:  { propuestaId_perfilId: { propuestaId, perfilId: Number(perfilId) } },
    update: updateData,
    create: { propuestaId, perfilId: Number(perfilId), ...updateData },
    include: {
      perfil:   true,
      empleado: { select: { id: true, nombre: true, apellido: true, costoHora: true } },
    },
  })

  return NextResponse.json({ success: true, data: linea, message: 'Línea guardada' }, { status: 201 })
}

// POST /api/v1/propuestas/:id/caso-negocio/cargar-tarifario
// Bulk: carga todas las líneas del tarifario activo de la empresa
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })
  if (ESTADOS_BLOQUEADOS.includes(propuesta.estado)) {
    return NextResponse.json({ success: false, message: 'El caso de negocio no se puede editar en el estado actual' }, { status: 409 })
  }

  const tarifarioId = propuesta.empresa?.tarifarioId
  if (!tarifarioId) {
    return NextResponse.json({ success: false, message: 'Esta empresa no tiene tarifario asignado' }, { status: 409 })
  }

  const lineasTarifario = await prisma.tarifarioLinea.findMany({
    where: { tarifarioId },
    include: { empleado: true, perfil: true },
  })

  if (lineasTarifario.length === 0) {
    return NextResponse.json({ success: false, message: 'El tarifario no tiene líneas configuradas' }, { status: 409 })
  }

  // Upsert cada línea del tarifario
  await Promise.all(
    lineasTarifario.map((tl) =>
      prisma.casoNegocioLinea.upsert({
        where:  { propuestaId_perfilId: { propuestaId, perfilId: tl.perfilId } },
        update: { empleadoId: tl.empleadoId, precioHora: tl.precioHora },
        create: { propuestaId, perfilId: tl.perfilId, horas: 0, empleadoId: tl.empleadoId, precioHora: tl.precioHora },
      })
    )
  )

  return NextResponse.json({ success: true, message: `${lineasTarifario.length} línea(s) cargadas desde el tarifario` })
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
