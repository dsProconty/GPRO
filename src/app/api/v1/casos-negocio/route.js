import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

/**
 * GET /api/v1/casos-negocio
 * Solo proyectos con al menos 1 línea de caso de negocio.
 * Params:
 *   ?from=YYYY-MM-DD   filtro fecha inicio
 *   ?to=YYYY-MM-DD     filtro fecha fin
 *   ?empresa_id=N      filtro por empresa
 *   ?estado_id=N       filtro por estado del proyecto
 */
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CASOS_NEGOCIO.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')
  const empresaId = searchParams.get('empresa_id')
  const estadoId  = searchParams.get('estado_id')

  const where = {}
  if (from || to) {
    where.fechaCreacion = {}
    if (from) where.fechaCreacion.gte = new Date(from)
    if (to)   where.fechaCreacion.lte = new Date(to + 'T23:59:59')
  }
  if (empresaId) where.empresaId = parseInt(empresaId)
  if (estadoId)  where.estadoId  = parseInt(estadoId)

  const [rawProyectos, estados, empresas] = await Promise.all([
    prisma.proyecto.findMany({
      where,
      include: {
        empresa: { select: { id: true, nombre: true } },
        estado:  { select: { id: true, nombre: true, color: true } },
        propuesta: { select: { id: true, titulo: true } },
        casoNegocio: {
          include: { perfilConsultor: true },
          orderBy: { perfilConsultor: { nombre: 'asc' } },
        },
        facturas: {
          select: { valor: true, pagos: { select: { valor: true } } },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    }),
    prisma.estado.findMany({ orderBy: { id: 'asc' } }),
    prisma.empresa.findMany({
      where: { proyectos: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const casos = rawProyectos.map((p) => {
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

    const facturado = p.facturas.reduce((s, f) => s + Number(f.valor), 0)
    const pagado    = p.facturas.reduce((s, f) => s + f.pagos.reduce((sp, pg) => sp + Number(pg.valor), 0), 0)
    const saldo     = facturado - pagado

    return {
      id: p.id,
      codigo: p.codigo,
      aplicativo: p.aplicativo,
      nombre: p.detalle,
      empresa: p.empresa,
      estado: p.estado,
      fecha: p.fechaCreacion,
      propuestaOrigen: p.propuesta,
      lineas,
      resumen: {
        totalHoras: lineas.reduce((s, l) => s + l.horas, 0),
        totalCosto,
        totalPrecio,
        gm,
        gmPct,
      },
      financiero: { facturado, pagado, saldo },
    }
  })

  // Resumen global
  const totalPrecio  = casos.reduce((s, c) => s + c.resumen.totalPrecio, 0)
  const totalCosto   = casos.reduce((s, c) => s + c.resumen.totalCosto,  0)
  const totalFact    = casos.reduce((s, c) => s + c.financiero.facturado, 0)
  const totalPagado  = casos.reduce((s, c) => s + c.financiero.pagado,    0)
  const gm           = totalPrecio - totalCosto
  const gmPct        = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0

  // Breakdown por perfil
  const perfilMap = {}
  casos.forEach((c) => {
    c.lineas.forEach((l) => {
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
      casos,
      resumenGlobal: {
        totalCaso:   casos.length,
        totalHoras:  casos.reduce((s, c) => s + c.resumen.totalHoras, 0),
        totalCosto,
        totalPrecio,
        gm,
        gmPct,
        totalFact,
        totalPagado,
        saldoPorCobrar: totalFact - totalPagado,
      },
      porPerfil,
      estados,
      empresas,
    },
    message: '',
  })
}
