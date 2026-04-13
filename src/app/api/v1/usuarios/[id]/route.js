import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { name, email, password, role, perfilUsuarioId } = await request.json()

  const errors = {}
  if (!name?.trim()) errors.name = ['El nombre es requerido']
  if (!email?.trim()) errors.email = ['El email es requerido']
  if (role && !['admin', 'user'].includes(role)) errors.role = ['Rol inválido']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const emailConflict = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id } } })
  if (emailConflict) return NextResponse.json({ success: false, message: 'Email ya en uso por otro usuario', errors: { email: ['Email ya en uso'] } }, { status: 422 })

  const data = {
    name: name.trim(),
    email: email.trim(),
    role: role || 'user',
    perfilUsuarioId: perfilUsuarioId ? parseInt(perfilUsuarioId) : null,
  }
  if (password && password.length >= 6) {
    data.password = await bcrypt.hash(password, 10)
  }

  try {
    const usuario = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, perfilUsuarioId: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: usuario, message: 'Usuario actualizado exitosamente' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 })
    throw e
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  if (parseInt(session.user.id) === id) {
    return NextResponse.json({ success: false, message: 'No puedes eliminar tu propio usuario' }, { status: 422 })
  }

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Usuario eliminado exitosamente' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 })
    throw e
  }
}
