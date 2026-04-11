import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/v1/perfiles-usuario — lista todos los perfiles (autenticado)
// POST /api/v1/perfiles-usuario — crea un perfil (solo admin)
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const perfiles = await prisma.perfilUsuario.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { usuarios: true } } },
  })

  return NextResponse.json({ success: true, data: perfiles, message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo el administrador puede gestionar perfiles' }, { status: 403 })
  }

  const { nombre, descripcion, permisos, estadosProyectoEditables } = await request.json()

  const errors = {}
  if (!nombre?.trim()) errors.nombre = ['El nombre es requerido']
  if (!Array.isArray(permisos)) errors.permisos = ['Los permisos deben ser un array']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const perfil = await prisma.perfilUsuario.create({
    data: {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      permisos,
      estadosProyectoEditables: estadosProyectoEditables ?? null,
    },
    include: { _count: { select: { usuarios: true } } },
  })

  return NextResponse.json({ success: true, data: perfil, message: 'Perfil creado exitosamente' }, { status: 201 })
}
