import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/admin/backfill-cierre-financiero
 * Body: { aplicar?: boolean }  — default false = solo vista previa, no escribe nada.
 *
 * Para cada proyecto en estado "Cerrado" sin fechaCierreFinanciero, calcula una fecha
 * tentativa de cierre financiero:
 *   - Sin facturas registradas            -> se omite (fuente: sin_facturas)
 *   - Con saldo pendiente (facturado>pagado) -> se omite (fuente: saldo_pendiente, requiere
 *     cierre forzado manual con permiso proyectos.cerrarFinanciero)
 *   - Pagado al 100% (saldo <= 0)          -> usa la fecha del ultimo cambio de estado a
 *     "Cerrado" en proyecto_estado_logs (fuente: estado_log); si no existe ese log (proyecto
 *     cerrado antes de que existiera el historial de estados), usa fechaCierre operativo
 *     (fuente: fecha_cierre); si tampoco hay eso, se omite (fuente: sin_dato).
 *
 * Solo admin. No modifica nada salvo que aplicar=true.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })
  }

  const { aplicar = false } = await request.json().catch(() => ({}))

  const estadoCerrado = await prisma.estado.findFirst({ where: { nombre: 'Cerrado' } })
  if (!estadoCerrado) {
    return NextResponse.json({ success: false, message: 'No existe el estado "Cerrado" en el catálogo' }, { status: 404 })
  }

  const proyectos = await prisma.proyecto.findMany({
    where: { estadoId: estadoCerrado.id, fechaCierreFinanciero: null },
    include: {
      facturas: { select: { valor: true, pagos: { select: { valor: true } } } },
      estadoLogs: { where: { estadoNuevoId: estadoCerrado.id }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { id: 'asc' },
  })

  const resultados = []

  for (const p of proyectos) {
    const facturado = p.facturas.reduce((s, f) => s + Number(f.valor), 0)
    const pagado = p.facturas.reduce((s, f) => s + f.pagos.reduce((sp, pg) => sp + Number(pg.valor), 0), 0)
    const saldo = facturado - pagado

    let fuente = 'sin_dato'
    let fecha = null

    if (facturado <= 0.001) {
      fuente = 'sin_facturas'
    } else if (saldo > 0.001) {
      fuente = 'saldo_pendiente'
    } else if (p.estadoLogs[0]) {
      fuente = 'estado_log'
      fecha = p.estadoLogs[0].createdAt
    } else if (p.fechaCierre) {
      fuente = 'fecha_cierre'
      fecha = p.fechaCierre
    }

    const item = {
      id: p.id,
      codigo: p.codigo,
      detalle: p.detalle,
      facturado,
      saldo,
      fuente,
      fechaTentativa: fecha,
      aplicado: false,
    }
    resultados.push(item)

    if (aplicar && fecha) {
      await prisma.proyecto.update({ where: { id: p.id }, data: { fechaCierreFinanciero: fecha } })
      item.aplicado = true
    }
  }

  const aplicables = resultados.filter((r) => r.fechaTentativa).length

  return NextResponse.json({
    success: true,
    data: resultados,
    message: aplicar
      ? `${resultados.filter((r) => r.aplicado).length} proyecto(s) actualizados con fecha de cierre financiero`
      : `${aplicables} de ${resultados.length} proyecto(s) cerrados tienen una fecha tentativa calculable`,
  })
}
