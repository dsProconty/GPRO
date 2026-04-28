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
    empleadoId:  l.empleadoId,
    perfil:      l.perfilConsultor,
    empleado:    l.empleado,
    horas:       Number(l.horas),
    costoHora:   Number(l.costoHora),
    precioHora:  Number(l.precioHora),
    costo:       Number(l.horas) * Number(l.costoHora),
    precio:      Number(l.horas) * Number(l.precioHora),
    gm:          Number(l.horas) * (Number(l.precioHora) - Number(l.costoHora)),
    gmPct:       Number(l.precioHora) > 0
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

  const [lineas, proyecto] = await Promise.all([
    prisma.proyectoCasoNegocioLinea.findMany({
      where: { proyectoId },
      include: {
        perfilConsultor: true,
        empleado: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { perfilConsultor: { nombre: 'asc' } },
    }),
    prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { empresa: { include: { tarifario: { select: { id: true, nombre: true } } } } },
    }),
  ])

  const serialized = serializeLineas(lineas)
  const tarifario = proyecto?.empresa?.tarifario || null
  return NextResponse.json({
    success: true,
    data: { lineas: serialized, resumen: calcResumen(lineas), tarifario },
    message: '',
  })
}

// PUT /api/v1/proyectos/:id/caso-negocio — carga líneas desde tarifario de la empresa
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar el caso de negocio' }, { status: 403 })
  }

  const proyectoId = parseInt(params.id)
  if (isNaN(proyectoId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: { empresa: true },
  })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })

  const tarifarioId = proyecto.empresa?.tarifarioId
  if (!tarifarioId) return NextResponse.json({ success: false, message: 'Esta empresa no tiene tarifario asignado' }, { status: 409 })

  const lineasTarifario = await prisma.tarifarioLinea.findMany({
    where: { tarifarioId },
    include: { empleado: true, perfil: true },
  })
  if (lineasTarifario.length === 0) {
    return NextResponse.json({ success: false, message: 'El tarifario no tiene líneas configuradas' }, { status: 409 })
  }

  await Promise.all(
    lineasTarifario.map((tl) => {
      const costoHora = tl.empleado ? Number(tl.empleado.costoHora) : Number(tl.perfil.costoHora)
      return prisma.proyectoCasoNegocioLinea.upsert({
        where: { proyectoId_perfilConsultorId: { proyectoId, perfilConsultorId: tl.perfilId } },
        update: { empleadoId: tl.empleadoId, precioHora: tl.precioHora, costoHora },
        create: { proyectoId, perfilConsultorId: tl.perfilId, horas: 0, empleadoId: tl.empleadoId, precioHora: tl.precioHora, costoHora },
      })
    })
  )

  return NextResponse.json({ success: true, message: `${lineasTarifario.length} línea(s) cargadas desde el tarifario` })
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

  const { perfilId, horas, empleadoId, precioHora } = await request.json()
  if (!perfilId) return NextResponse.json({ success: false, message: 'perfilId es requerido' }, { status: 422 })
  if (!horas || Number(horas) <= 0) return NextResponse.json({ success: false, message: 'horas debe ser mayor a 0' }, { status: 422 })

  const perfil = await prisma.perfilConsultor.findFirst({ where: { id: parseInt(perfilId), activo: true } })
  if (!perfil) return NextResponse.json({ success: false, message: 'Perfil no encontrado o inactivo' }, { status: 422 })

  // precioHora override si se envía, si no usa el del perfil
  const precio = precioHora !== undefined && precioHora !== null ? Number(precioHora) : Number(perfil.precioHora)

  // costoHora: usa el del empleado asignado si existe, si no el del perfil
  let costo = Number(perfil.costoHora)
  if (empleadoId) {
    const emp = await prisma.empleado.findUnique({ where: { id: Number(empleadoId) } })
    if (emp) costo = Number(emp.costoHora)
  }

  await prisma.proyectoCasoNegocioLinea.upsert({
    where: { proyectoId_perfilConsultorId: { proyectoId, perfilConsultorId: perfil.id } },
    update: { horas: parseFloat(horas), costoHora: costo, precioHora: precio, empleadoId: empleadoId ? Number(empleadoId) : null },
    create: { proyectoId, perfilConsultorId: perfil.id, horas: parseFloat(horas), costoHora: costo, precioHora: precio, empleadoId: empleadoId ? Number(empleadoId) : null },
  })

  const lineas = await prisma.proyectoCasoNegocioLinea.findMany({
    where: { proyectoId },
    include: {
      perfilConsultor: true,
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
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
    include: {
      perfilConsultor: true,
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { perfilConsultor: { nombre: 'asc' } },
  })

  return NextResponse.json({
    success: true,
    data: { lineas: serializeLineas(lineas), resumen: calcResumen(lineas) },
    message: 'Línea eliminada',
  })
}
