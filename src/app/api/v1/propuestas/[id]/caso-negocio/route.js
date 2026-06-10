import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

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

function buildLineasCalculadas(lineas) {
  return lineas.map((l) => {
    const precioHora = l.precioHora !== null ? Number(l.precioHora) : Number(l.perfil.precioHora)
    const costoHora  = l.empleado   ? Number(l.empleado.costoHora)  : Number(l.perfil.costoHora)
    return {
      id:          l.id,
      propuestaId: l.propuestaId,
      perfilId:    l.perfilId,
      empleadoId:  l.empleadoId,
      horas:       Number(l.horas),
      perfil:      l.perfil,
      empleado:    l.empleado,
      costoHora,
      precioHora,
      costo:       Number(l.horas) * costoHora,
      precio:      Number(l.horas) * precioHora,
    }
  })
}

const LINEA_INCLUDE = {
  perfil:   true,
  empleado: { select: { id: true, nombre: true, apellido: true, costoHora: true } },
}

// GET /api/v1/propuestas/:id/caso-negocio
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para ver el caso de negocio' }, { status: 403 })
  }

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)

  const lineas = await prisma.casoNegocioLinea.findMany({
    where: { propuestaId },
    include: LINEA_INCLUDE,
    orderBy: { perfil: { nombre: 'asc' } },
  })

  const lineasCalculadas = buildLineasCalculadas(lineas)

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
// Si viene lineaId: actualiza esa línea. Si no: crea una nueva.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para editar el caso de negocio' }, { status: 403 })
  }

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })
  if (ESTADOS_BLOQUEADOS.includes(propuesta.estado)) {
    return NextResponse.json({ success: false, message: 'El caso de negocio no se puede editar en el estado actual' }, { status: 409 })
  }

  const { lineaId, perfilId, horas, empleadoId, precioHora } = await request.json()

  if (!perfilId) return NextResponse.json({ success: false, message: 'perfilId es requerido' }, { status: 422 })
  if (!horas || Number(horas) <= 0) return NextResponse.json({ success: false, message: 'Las horas deben ser mayores a 0' }, { status: 422 })

  const perfil = await prisma.perfilConsultor.findUnique({ where: { id: Number(perfilId) } })
  if (!perfil) return NextResponse.json({ success: false, message: 'Perfil no encontrado' }, { status: 404 })
  if (!perfil.activo) return NextResponse.json({ success: false, message: 'Este perfil está inactivo' }, { status: 409 })

  const lineaData = {
    horas:      Number(horas),
    empleadoId: empleadoId ? Number(empleadoId) : null,
    precioHora: precioHora !== undefined && precioHora !== null ? Number(precioHora) : null,
  }

  let linea
  if (lineaId) {
    linea = await prisma.casoNegocioLinea.update({
      where:   { id: Number(lineaId) },
      data:    lineaData,
      include: LINEA_INCLUDE,
    })
  } else {
    linea = await prisma.casoNegocioLinea.create({
      data:    { propuestaId, perfilId: Number(perfilId), ...lineaData },
      include: LINEA_INCLUDE,
    })
  }

  return NextResponse.json({ success: true, data: linea, message: 'Línea guardada' }, { status: 201 })
}

// PUT /api/v1/propuestas/:id/caso-negocio — bulk: carga desde tarifario (append)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para editar el caso de negocio' }, { status: 403 })
  }

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

  await prisma.casoNegocioLinea.createMany({
    data: lineasTarifario.map((tl) => ({
      propuestaId,
      perfilId:   tl.perfilId,
      horas:      0,
      empleadoId: tl.empleadoId || null,
      precioHora: tl.precioHora ? Number(tl.precioHora) : null,
    })),
  })

  return NextResponse.json({ success: true, message: `${lineasTarifario.length} línea(s) cargadas desde el tarifario` })
}

// DELETE /api/v1/propuestas/:id/caso-negocio?lineaId=X
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para editar el caso de negocio' }, { status: 403 })
  }

  const propuestaId = parseInt(params.id)
  if (isNaN(propuestaId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const propuesta = await getPropuesta(propuestaId)
  if (!propuesta) return NextResponse.json({ success: false, message: 'Propuesta no encontrada' }, { status: 404 })
  if (ESTADOS_BLOQUEADOS.includes(propuesta.estado)) {
    return NextResponse.json({ success: false, message: 'El caso de negocio no se puede editar en el estado actual' }, { status: 409 })
  }

  const { searchParams } = new URL(request.url)
  const lineaId = parseInt(searchParams.get('lineaId'))
  if (isNaN(lineaId)) return NextResponse.json({ success: false, message: 'lineaId inválido' }, { status: 400 })

  await prisma.casoNegocioLinea.delete({
    where: { id: lineaId },
  })

  return NextResponse.json({ success: true, message: 'Línea eliminada' })
}
