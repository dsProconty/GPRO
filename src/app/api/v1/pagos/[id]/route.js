import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PAGOS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar pagos' }, { status: 403 })
  }

  const id = parseInt(params.id)
  const body = await request.json()
  const { valor, fecha, observacion } = body

  const errors = {}
  if (!valor || Number(valor) <= 0) errors.valor = ['El valor debe ser mayor a 0']
  if (!fecha) errors.fecha = ['La fecha es requerida']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  const pagoActual = await prisma.pago.findUnique({ where: { id } })
  if (!pagoActual) return NextResponse.json({ success: false, message: 'Pago no encontrado' }, { status: 404 })

  // RN-02: Calcular saldo excluyendo el pago actual
  const factura = await prisma.factura.findUnique({
    where: { id: pagoActual.facturaId },
    include: { pagos: { select: { id: true, valor: true } } },
  })

  const totalOtrosPagos = factura.pagos.reduce((s, p) => p.id === id ? s : s + Number(p.valor), 0)
  const saldo = Number(factura.valor) - totalOtrosPagos

  if (Number(valor) > saldo + 0.001) {
    return NextResponse.json({
      success: false,
      message: `El pago supera el saldo disponible ($${saldo.toFixed(2)})`,
      errors: { valor: [`Máximo permitido: $${saldo.toFixed(2)}`] },
    }, { status: 422 })
  }

  try {
    const pago = await prisma.pago.update({
      where: { id },
      data: { valor: parseFloat(valor), fecha: new Date(fecha), observacion: observacion?.trim() || null },
    })
    return NextResponse.json({ success: true, data: { ...pago, valor: Number(pago.valor) }, message: 'Pago actualizado' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Pago no encontrado' }, { status: 404 })
    throw e
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.PAGOS.ELIMINAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para eliminar pagos' }, { status: 403 })
  }

  const id = parseInt(params.id)
  try {
    await prisma.pago.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Pago eliminado' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Pago no encontrado' }, { status: 404 })
    throw e
  }
}
