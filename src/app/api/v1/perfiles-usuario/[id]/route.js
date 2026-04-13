import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/v1/perfiles-usuario/:id — actualiza un perfil (solo admin)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo el administrador puede gestionar perfiles' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { nombre, descripcion, permisos, estadosProyectoEditables } = await request.json()

  const errors = {}
  if (!nombre?.trim()) errors.nombre = ['El nombre es requerido']
  if (!Array.isArray(permisos)) errors.permisos = ['Los permisos deben ser un array']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  try {
    const perfil = await prisma.perfilUsuario.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        permisos,
        estadosProyectoEditables: estadosProyectoEditables ?? null,
      },
      include: { _count: { select: { usuarios: true } } },
    })

    return NextResponse.json({ success: true, data: perfil, message: 'Perfil actualizado exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Perfil no encontrado' }, { status: 404 })
    }
    throw error
  }
}

// DELETE /api/v1/perfiles-usuario/:id — elimina un perfil (solo admin, sin usuarios asignados)
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo el administrador puede gestionar perfiles' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const usuariosCount = await prisma.user.count({ where: { perfilUsuarioId: id } })
  if (usuariosCount > 0) {
    return NextResponse.json(
      { success: false, message: `No se puede eliminar: el perfil tiene ${usuariosCount} usuario(s) asignado(s)` },
      { status: 422 }
    )
  }

  try {
    await prisma.perfilUsuario.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null, message: 'Perfil eliminado exitosamente' })
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, message: 'Perfil no encontrado' }, { status: 404 })
    }
    throw error
  }
}
