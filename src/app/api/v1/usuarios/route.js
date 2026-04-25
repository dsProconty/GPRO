import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const usuarios = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      perfilUsuarioId: true,
      perfilUsuario: { select: { id: true, nombre: true } },
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ success: true, data: usuarios, message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores pueden crear usuarios' }, { status: 403 })

  const { name, email, password, role, perfilUsuarioId } = await request.json()

  const errors = {}
  if (!name?.trim()) errors.name = ['El nombre es requerido']
  if (!email?.trim()) errors.email = ['El email es requerido']
  if (!password || password.length < 6) errors.password = ['La contraseña debe tener al menos 6 caracteres']
  if (role && !['admin', 'user'].includes(role)) errors.role = ['Rol inválido']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const exists = await prisma.user.findUnique({ where: { email: email.trim() } })
  if (exists) return NextResponse.json({ success: false, message: 'Ya existe un usuario con ese email', errors: { email: ['Email ya en uso'] } }, { status: 422 })

  const hashed = await bcrypt.hash(password, 10)
  const usuario = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim(),
      password: hashed,
      role: role || 'user',
      perfilUsuarioId: perfilUsuarioId ? parseInt(perfilUsuarioId) : null,
    },
    select: { id: true, name: true, email: true, role: true, perfilUsuarioId: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: usuario, message: 'Usuario creado exitosamente' }, { status: 201 })
}
