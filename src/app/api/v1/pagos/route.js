import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const facturaId = searchParams.get('factura_id')
  if (!facturaId) return NextResponse.json({ success: false, message: 'factura_id requerido' }, { status: 400 })

  const pagos = await prisma.pago.findMany({
    where: { facturaId: parseInt(facturaId) },
    orderBy: { fecha: 'asc' },
  })

  return NextResponse.json({ success: true, data: pagos.map((p) => ({ ...p, valor: Number(p.valor) })), message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { facturaId, valor, fecha, observacion } = body

  const errors = {}
  if (!facturaId) errors.facturaId = ['La factura es requerida']
  if (!valor || Number(valor) <= 0) errors.valor = ['El valor debe ser mayor a 0']
  if (!fecha) errors.fecha = ['La fecha es requerida']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  // RN-02: Validar saldo disponible
  const factura = await prisma.factura.findUnique({
    where: { id: parseInt(facturaId) },
    include: { pagos: { select: { valor: true } } },
  })
  if (!factura) return NextResponse.json({ success: false, message: 'Factura no encontrada' }, { status: 422 })

  const totalPagos = factura.pagos.reduce((s, p) => s + Number(p.valor), 0)
  const saldo = Number(factura.valor) - totalPagos

  if (Number(valor) > saldo + 0.001) {
    return NextResponse.json({
      success: false,
      message: `El pago supera el saldo disponible ($${saldo.toFixed(2)})`,
      errors: { valor: [`Máximo permitido: $${saldo.toFixed(2)}`] },
    }, { status: 422 })
  }

  try {
    const pago = await prisma.pago.create({
      data: {
        facturaId: parseInt(facturaId),
        valor: parseFloat(valor),
        fecha: new Date(fecha),
        observacion: observacion?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: { ...pago, valor: Number(pago.valor) }, message: 'Pago registrado' }, { status: 201 })
  } catch (error) {
    if (error.code === 'P2003') {
      return NextResponse.json({ success: false, message: 'Factura no encontrada' }, { status: 422 })
    }
    throw error
  }
}
