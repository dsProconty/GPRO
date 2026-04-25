import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarDestinatarios(str) {
  if (!str?.trim()) return false
  return str.split(',').map((e) => e.trim()).filter(Boolean).every((e) => EMAIL_REGEX.test(e))
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const body = await request.json()
  const { diaMes, descripcion, destinatarios, activo } = body

  const errors = {}
  if (!diaMes || diaMes < 1 || diaMes > 28) errors.diaMes = ['El día debe ser entre 1 y 28']
  if (!descripcion?.trim()) errors.descripcion = ['La descripción es requerida']
  if (!destinatarios?.trim()) errors.destinatarios = ['Los destinatarios son requeridos']
  else if (!validarDestinatarios(destinatarios)) errors.destinatarios = ['Ingresa emails válidos separados por coma']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  try {
    const recordatorio = await prisma.recordatorioFactura.update({
      where: { id },
      data: {
        diaMes: parseInt(diaMes),
        descripcion: descripcion.trim(),
        destinatarios: destinatarios.split(',').map((e) => e.trim()).filter(Boolean).join(', '),
        activo: activo ?? true,
      },
    })
    return NextResponse.json({ success: true, data: recordatorio, message: 'Recordatorio actualizado' })
  } catch (error) {
    if (error.code === 'P2025') return NextResponse.json({ success: false, message: 'Recordatorio no encontrado' }, { status: 404 })
    return NextResponse.json({ success: false, message: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  try {
    await prisma.recordatorioFactura.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Recordatorio eliminado' })
  } catch (error) {
    if (error.code === 'P2025') return NextResponse.json({ success: false, message: 'Recordatorio no encontrado' }, { status: 404 })
    return NextResponse.json({ success: false, message: 'Error al eliminar' }, { status: 500 })
  }
}
