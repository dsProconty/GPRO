import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function calcFactura(f) {
  const totalPagos = f.pagos.reduce((s, p) => s + Number(p.valor), 0)
  return { ...f, valor: Number(f.valor), totalPagos, saldo: Number(f.valor) - totalPagos }
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: { pagos: { orderBy: { fecha: 'asc' } } },
  })
  if (!factura) return NextResponse.json({ success: false, message: 'Factura no encontrada' }, { status: 404 })
  return NextResponse.json({ success: true, data: calcFactura(factura), message: '' })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  const body = await request.json()
  const { numFactura, ordenCompra, valor, fechaFactura, observacion } = body

  const errors = {}
  if (!numFactura?.trim()) errors.numFactura = ['El número de factura es requerido']
  else if (!/^\d{3}-\d{3}-\d{9}$/.test(numFactura.trim())) errors.numFactura = ['Formato inválido. Use: 001-001-000000000']
  if (!valor || Number(valor) <= 0) errors.valor = ['El valor debe ser mayor a 0']
  if (!fechaFactura) errors.fechaFactura = ['La fecha de factura es requerida']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  const dup = await prisma.factura.findFirst({ where: { numFactura: numFactura.trim(), NOT: { id } } })
  if (dup) return NextResponse.json({ success: false, message: 'Número de factura duplicado', errors: { numFactura: ['Ya existe una factura con ese número'] } }, { status: 422 })

  try {
    const factura = await prisma.factura.update({
      where: { id },
      data: {
        numFactura: numFactura.trim(),
        ordenCompra: ordenCompra?.trim() || null,
        valor: parseFloat(valor),
        fechaFactura: new Date(fechaFactura),
        observacion: observacion?.trim() || null,
      },
      include: { pagos: true },
    })
    return NextResponse.json({ success: true, data: calcFactura(factura), message: 'Factura actualizada' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Factura no encontrada' }, { status: 404 })
    throw e
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  try {
    await prisma.factura.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Factura eliminada' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Factura no encontrada' }, { status: 404 })
    throw e
  }
}
