import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

/**
 * GET /api/v1/casos-negocio
 * Params opcionales:
 *   ?from=YYYY-MM-DD  filtro fecha inicio del proyecto/propuesta
 *   ?to=YYYY-MM-DD    filtro fecha fin
 *   ?tipo=proyecto|propuesta  (omitir = ambos)
 *
 * Responde con:
 *  - proyectos[]: cada proyecto con sus líneas de caso de negocio + totales
 *  - propuestas[]: propuestas con caso de negocio (no aprobadas)
 *  - resumenGlobal: totales agregados
 *  - porPerfil[]: ingresos/costos/GM agrupados por perfilConsultor
 *  - porMes[]: ingresos agrupados por mes (últimos 12 meses por fechaCreacion)
 */
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.VER)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para ver los casos de negocio' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const from  = searchParams.get('from')
  const to    = searchParams.get('to')
  const tipo  = searchParams.get('tipo') // 'proyecto' | 'propuesta' | null

  const dateFilter = {}
  if (from) dateFilter.gte = new Date(from)
  if (to)   dateFilter.lte = new Date(to + 'T23:59:59')

  // ── Proyectos con caso de negocio ─────────────────────────────────────────
  let proyectos = []
  if (!tipo || tipo === 'proyecto') {
    const rawProyectos = await prisma.proyecto.findMany({
      where: {
        casoNegocio: { some: {} }, // solo proyectos que tienen al menos 1 línea
        ...(Object.keys(dateFilter).length > 0 ? { fechaCreacion: dateFilter } : {}),
      },
      include: {
        empresa: { select: { id: true, nombre: true } },
        estado:  { select: { id: true, nombre: true, color: true } },
        propuesta: { select: { id: true, titulo: true } },
        casoNegocio: {
          include: { perfilConsultor: true },
          orderBy: { perfilConsultor: { nombre: 'asc' } },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    })

    proyectos = rawProyectos.map((p) => {
      const lineas = p.casoNegocio.map((l) => ({
        perfilConsultorId: l.perfilConsultorId,
        perfil: { nombre: l.perfilConsultor.nombre, nivel: l.perfilConsultor.nivel },
        horas:      Number(l.horas),
        costoHora:  Number(l.costoHora),
        precioHora: Number(l.precioHora),
        costo:      Number(l.horas) * Number(l.costoHora),
        precio:     Number(l.horas) * Number(l.precioHora),
        gm:         Number(l.horas) * (Number(l.precioHora) - Number(l.costoHora)),
      }))
      const totalCosto  = lineas.reduce((s, l) => s + l.costo, 0)
      const totalPrecio = lineas.reduce((s, l) => s + l.precio, 0)
      const gm          = totalPrecio - totalCosto
      const gmPct       = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
      return {
        tipo: 'proyecto',
        id: p.id,
        nombre: p.detalle,
        empresa: p.empresa,
        estado: p.estado,
        fecha: p.fechaCreacion,
        propuestaOrigen: p.propuesta,
        lineas,
        resumen: { totalHoras: lineas.reduce((s, l) => s + l.horas, 0), totalCosto, totalPrecio, gm, gmPct },
      }
    })
  }

  // ── Propuestas con caso de negocio (excluye Aprobadas que ya tienen proyecto) ─
  let propuestas = []
  if (!tipo || tipo === 'propuesta') {
    const rawPropuestas = await prisma.propuesta.findMany({
      where: {
        casoNegocio: { some: {} },
        estado: { notIn: ['Aprobada'] }, // Aprobadas ya están como proyectos
        ...(Object.keys(dateFilter).length > 0 ? { fechaCreacion: dateFilter } : {}),
      },
      include: {
        empresa:  { select: { id: true, nombre: true } },
        casoNegocio: {
          include: { perfil: true },
          orderBy: { perfil: { nombre: 'asc' } },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    })

    propuestas = rawPropuestas.map((p) => {
      const lineas = p.casoNegocio.map((l) => ({
        perfilConsultorId: l.perfilId,
        perfil: { nombre: l.perfil.nombre, nivel: l.perfil.nivel },
        horas:      Number(l.horas),
        costoHora:  Number(l.perfil.costoHora),
        precioHora: Number(l.perfil.precioHora),
        costo:      Number(l.horas) * Number(l.perfil.costoHora),
        precio:     Number(l.horas) * Number(l.perfil.precioHora),
        gm:         Number(l.horas) * (Number(l.perfil.precioHora) - Number(l.perfil.costoHora)),
      }))
      const totalCosto  = lineas.reduce((s, l) => s + l.costo, 0)
      const totalPrecio = lineas.reduce((s, l) => s + l.precio, 0)
      const gm          = totalPrecio - totalCosto
      const gmPct       = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
      return {
        tipo: 'propuesta',
        id: p.id,
        nombre: p.titulo,
        empresa: p.empresa,
        estado: { nombre: p.estado, color: 'info' },
        fecha: p.fechaCreacion,
        propuestaOrigen: null,
        lineas,
        resumen: { totalHoras: lineas.reduce((s, l) => s + l.horas, 0), totalCosto, totalPrecio, gm, gmPct },
      }
    })
  }

  const todos = [...proyectos, ...propuestas]

  // ── Resumen global ─────────────────────────────────────────────────────────
  const resumenGlobal = {
    totalCaso:   todos.length,
    totalHoras:  todos.reduce((s, c) => s + c.resumen.totalHoras, 0),
    totalCosto:  todos.reduce((s, c) => s + c.resumen.totalCosto, 0),
    totalPrecio: todos.reduce((s, c) => s + c.resumen.totalPrecio, 0),
    get gm()    { return this.totalPrecio - this.totalCosto },
    get gmPct() { return this.totalPrecio > 0 ? Math.round((this.gm / this.totalPrecio) * 100) : 0 },
  }

  // ── Breakdown por perfil ───────────────────────────────────────────────────
  const perfilMap = {}
  todos.forEach((caso) => {
    caso.lineas.forEach((l) => {
      const key = `${l.perfil.nombre} ${l.perfil.nivel}`
      if (!perfilMap[key]) perfilMap[key] = { perfil: key, horas: 0, costo: 0, precio: 0 }
      perfilMap[key].horas  += l.horas
      perfilMap[key].costo  += l.costo
      perfilMap[key].precio += l.precio
    })
  })
  const porPerfil = Object.values(perfilMap)
    .map((p) => ({ ...p, gm: p.precio - p.costo, gmPct: p.precio > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 100) : 0 }))
    .sort((a, b) => b.precio - a.precio)

  return NextResponse.json({
    success: true,
    data: {
      casos: todos,
      resumenGlobal: {
        totalCaso:   resumenGlobal.totalCaso,
        totalHoras:  resumenGlobal.totalHoras,
        totalCosto:  resumenGlobal.totalCosto,
        totalPrecio: resumenGlobal.totalPrecio,
        gm:          resumenGlobal.gm,
        gmPct:       resumenGlobal.gmPct,
      },
      porPerfil,
    },
    message: '',
  })
}
