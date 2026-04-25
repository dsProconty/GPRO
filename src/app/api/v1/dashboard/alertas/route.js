import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/v1/dashboard/alertas?dias=30
// Retorna facturas con saldo > 0 y antigüedad >= N días
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dias = parseInt(searchParams.get('dias') || '30')

  try {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - dias)

    const facturas = await prisma.factura.findMany({
      where: { fechaFactura: { lte: fechaLimite } },
      include: {
        pagos: { select: { valor: true } },
        proyecto: {
          select: {
            id: true,
            detalle: true,
            empresa: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaFactura: 'asc' },
    })

    const hoy = new Date()

    const alertas = facturas
      .map((f) => {
        const totalPagos = f.pagos.reduce((s, p) => s + Number(p.valor), 0)
        const saldo = Number(f.valor) - totalPagos
        const diasMora = Math.floor((hoy - new Date(f.fechaFactura)) / (1000 * 60 * 60 * 24))
        return { ...f, saldo, totalPagos, diasMora }
      })
      .filter((f) => f.saldo > 0.001)

    return NextResponse.json({
      success: true,
      data: alertas.map((f) => ({
        id: f.id,
        numFactura: f.numFactura,
        fechaFactura: f.fechaFactura,
        valor: Number(f.valor),
        totalPagos: f.totalPagos,
        saldo: f.saldo,
        diasMora: f.diasMora,
        proyecto: f.proyecto,
      })),
      message: '',
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error al cargar alertas' }, { status: 500 })
  }
}
