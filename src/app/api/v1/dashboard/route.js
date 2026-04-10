import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  try {
    const [proyectos, facturas, pagos] = await Promise.all([
      prisma.proyecto.findMany({
        select: { id: true, estadoId: true },
      }),
      prisma.factura.findMany({
        select: { valor: true },
      }),
      prisma.pago.findMany({
        select: { valor: true },
      }),
    ])

    // Estados: 1=Prefactibilidad, 2=Elaboracion_Propuesta, 3=Adjudicado, 4=Rechazado, 5=Cerrado
    const ESTADOS_ACTIVOS = [1, 2, 3]
    const proyectosActivos = proyectos.filter((p) => ESTADOS_ACTIVOS.includes(p.estadoId)).length
    const totalProyectos = proyectos.length

    const facturadoTotal = facturas.reduce((s, f) => s + Number(f.valor), 0)
    const cobradoTotal = pagos.reduce((s, p) => s + Number(p.valor), 0)
    const saldoPendiente = facturadoTotal - cobradoTotal

    return NextResponse.json({
      success: true,
      data: {
        proyectosActivos,
        totalProyectos,
        facturadoTotal,
        cobradoTotal,
        saldoPendiente,
      },
      message: '',
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error al cargar el dashboard' }, { status: 500 })
  }
}
