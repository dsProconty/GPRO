import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.CLIENTES.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar clientes' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })
  }

  const { nombre, apellido, telefono, mail, empresaId } = await request.json()
  const errors = {}

  if (!nombre || nombre.trim() === '') errors.nombre = ['El nombre es requerido']
  if (!apellido || apellido.trim() === '') errors.apellido = ['El apellido es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (mail && mail.trim() !== '' && !EMAIL_REGEX.test(mail)) errors.mail = ['Email inválido']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { success: false, message: 'Error de validación', errors },
      { status: 422 }
    )
  }

  const empresaExiste = await prisma.empresa.findUnique({ where: { id: parseInt(empresaId) } })
  if (!empresaExiste) {
    return NextResponse.json(
      { success: false, message: 'La empresa especificada no existe', errors: { empresaId: ['Empresa no encontrada'] } },
      { status: 422 }
    )
  }

  try {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() || null,
        mail: mail?.trim() || null,
        empresaId: parseInt(empresaId),
      },
      include: { empresa: { select: { id: true, nombre: true } } },
    })
    return NextResponse.json({ success: true, data: cliente, message: 'Cliente actualizado exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Cliente no encontrado' }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.CLIENTES.ELIMINAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para eliminar clientes' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })
  }

  try {
    await prisma.cliente.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Cliente eliminado exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Cliente no encontrado' }, { status: 404 })
    }
    throw error
  }
}
