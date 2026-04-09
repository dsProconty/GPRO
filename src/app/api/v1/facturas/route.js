import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function calcFactura(f) {
  const totalPagos = f.pagos.reduce((s, p) => s + Number(p.valor), 0)
  return { ...f, valor: Number(f.valor), totalPagos, saldo: Number(f.valor) - totalPagos }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ success: false, message: 'proyecto_id requerido' }, { status: 400 })

  const facturas = await prisma.factura.findMany({
    where: { proyectoId: parseInt(proyectoId) },
    include: { pagos: { orderBy: { fecha: 'asc' } } },
    orderBy: { fechaFactura: 'asc' },
  })

  return NextResponse.json({ success: true, data: facturas.map(calcFactura), message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { numFactura, proyectoId, ordenCompra, valor, fechaFactura, observacion } = body

  const errors = {}
  if (!numFactura?.trim()) errors.numFactura = ['El número de factura es requerido']
  else if (!/^\d{3}-\d{3}-\d{9}$/.test(numFactura.trim())) errors.numFactura = ['Formato inválido. Use: 001-001-000000000']
  if (!proyectoId) errors.proyectoId = ['El proyecto es requerido']
  if (!valor || Number(valor) <= 0) errors.valor = ['El valor debe ser mayor a 0']
  if (!fechaFactura) errors.fechaFactura = ['La fecha de factura es requerida']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  const proyecto = await prisma.proyecto.findUnique({ where: { id: parseInt(proyectoId) } })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 422 })

  const dup = await prisma.factura.findUnique({ where: { numFactura: numFactura.trim() } })
  if (dup) return NextResponse.json({ success: false, message: 'Número de factura duplicado', errors: { numFactura: ['Ya existe una factura con ese número'] } }, { status: 422 })

  const factura = await prisma.factura.create({
    data: {
      numFactura: numFactura.trim(),
      proyectoId: parseInt(proyectoId),
      ordenCompra: ordenCompra?.trim() || null,
      valor: parseFloat(valor),
      fechaFactura: new Date(fechaFactura),
      observacion: observacion?.trim() || null,
    },
    include: { pagos: true },
  })

  return NextResponse.json({ success: true, data: calcFactura(factura), message: 'Factura creada' }, { status: 201 })
}
