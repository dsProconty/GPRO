import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  try {
    const diaHoy = new Date().getDate()

    const [proyectos, facturas, pagos, estados, recordatoriosHoy] = await Promise.all([
      prisma.proyecto.findMany({
        select: { id: true, estadoId: true, estado: { select: { nombre: true } } },
      }),
      prisma.factura.findMany({
        select: { valor: true, fechaFactura: true, proyectoId: true },
      }),
      prisma.pago.findMany({
        select: { valor: true, fecha: true, facturaId: true, factura: { select: { proyectoId: true } } },
      }),
      prisma.estado.findMany({ select: { id: true, nombre: true } }),
      prisma.recordatorioFactura.count({ where: { activo: true, diaMes: diaHoy } }),
    ])

    // ── KPIs básicos ────────────────────────────────────────────
    const ESTADOS_ACTIVOS = [1, 2, 3]
    const proyectosActivos = proyectos.filter((p) => ESTADOS_ACTIVOS.includes(p.estadoId)).length
    const totalProyectos = proyectos.length
    const facturadoTotal = facturas.reduce((s, f) => s + Number(f.valor), 0)
    const cobradoTotal = pagos.reduce((s, p) => s + Number(p.valor), 0)
    const saldoPendiente = facturadoTotal - cobradoTotal

    // ── Por Estado ───────────────────────────────────────────────
    const porEstado = estados.map((e) => ({
      nombre: e.nombre,
      total: proyectos.filter((p) => p.estadoId === e.id).length,
    })).filter((e) => e.total > 0)

    // ── Por Mes (últimos 12 meses) ───────────────────────────────
    const porMes = generarUltimos12Meses(facturas, pagos)

    // ── Top 5 Clientes por facturado ─────────────────────────────
    const topClientes = await obtenerTopClientes()

    return NextResponse.json({
      success: true,
      data: {
        proyectosActivos,
        totalProyectos,
        facturadoTotal,
        cobradoTotal,
        saldoPendiente,
        recordatoriosHoy,
        porEstado,
        porMes,
        topClientes,
      },
      message: '',
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error al cargar el dashboard' }, { status: 500 })
  }
}

function generarUltimos12Meses(facturas, pagos) {
  const meses = []
  const hoy = new Date()

  for (let i = 11; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const anio = fecha.getFullYear()
    const mes = fecha.getMonth() // 0-11

    const facturado = facturas
      .filter((f) => {
        const d = new Date(f.fechaFactura)
        return d.getFullYear() === anio && d.getMonth() === mes
      })
      .reduce((s, f) => s + Number(f.valor), 0)

    const cobrado = pagos
      .filter((p) => {
        const d = new Date(p.fecha)
        return d.getFullYear() === anio && d.getMonth() === mes
      })
      .reduce((s, p) => s + Number(p.valor), 0)

    meses.push({
      mes: fecha.toLocaleDateString('es-EC', { month: 'short', year: '2-digit' }),
      facturado,
      cobrado,
    })
  }

  return meses
}

async function obtenerTopClientes() {
  const empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      nombre: true,
      proyectos: {
        select: {
          facturas: { select: { valor: true } },
        },
      },
    },
  })

  return empresas
    .map((e) => ({
      nombre: e.nombre,
      total: e.proyectos.reduce(
        (s, p) => s + p.facturas.reduce((sf, f) => sf + Number(f.valor), 0),
        0
      ),
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}
