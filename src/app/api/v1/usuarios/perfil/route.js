import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// PUT — actualizar nombre
export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { name } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors: { name: ['El nombre es requerido'] } }, { status: 422 })
  }

  const usuario = await prisma.user.update({
    where: { id: parseInt(session.user.id) },
    data: { name: name.trim() },
    select: { id: true, name: true, email: true, role: true },
  })

  return NextResponse.json({ success: true, data: usuario, message: 'Perfil actualizado exitosamente' })
}

// PATCH — cambiar contraseña
export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { passwordActual, passwordNueva, passwordConfirmar } = await request.json()

  const errors = {}
  if (!passwordActual) errors.passwordActual = ['La contraseña actual es requerida']
  if (!passwordNueva || passwordNueva.length < 8) errors.passwordNueva = ['La nueva contraseña debe tener al menos 8 caracteres']
  if (passwordNueva !== passwordConfirmar) errors.passwordConfirmar = ['Las contraseñas no coinciden']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const user = await prisma.user.findUnique({ where: { id: parseInt(session.user.id) } })
  const match = await bcrypt.compare(passwordActual, user.password)
  if (!match) {
    return NextResponse.json({ success: false, message: 'La contraseña actual es incorrecta', errors: { passwordActual: ['Contraseña incorrecta'] } }, { status: 422 })
  }

  const hashed = await bcrypt.hash(passwordNueva, 10)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

  return NextResponse.json({ success: true, data: null, message: 'Contraseña actualizada exitosamente' })
}
