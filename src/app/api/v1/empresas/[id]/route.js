import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id },
    include: { _count: { select: { clientes: true } } },
  })

  if (!empresa) {
    return NextResponse.json({ success: false, message: 'Empresa no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: empresa, message: '' })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.EMPRESAS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar empresas' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })
  }

  const { nombre, ciudad } = await request.json()

  if (!nombre || nombre.trim() === '') {
    return NextResponse.json(
      { success: false, message: 'El nombre es requerido', errors: { nombre: ['El nombre es requerido'] } },
      { status: 422 }
    )
  }

  try {
    const empresa = await prisma.empresa.update({
      where: { id },
      data: { nombre: nombre.trim(), ciudad: ciudad?.trim() || null },
    })
    return NextResponse.json({ success: true, data: empresa, message: 'Empresa actualizada exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Empresa no encontrada' }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.EMPRESAS.ELIMINAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para eliminar empresas' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })
  }

  const clientesCount = await prisma.cliente.count({ where: { empresaId: id } })
  if (clientesCount > 0) {
    return NextResponse.json(
      { success: false, message: 'No se puede eliminar: la empresa tiene clientes asociados' },
      { status: 422 }
    )
  }

  try {
    await prisma.empresa.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Empresa eliminada exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Empresa no encontrada' }, { status: 404 })
    }
    throw error
  }
}
