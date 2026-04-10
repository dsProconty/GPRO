import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/v1/configuracion/estados-proyecto/:id — editar nombre/color
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { nombre, descripcion, color } = await request.json()
  if (!nombre?.trim()) {
    return NextResponse.json({ success: false, message: 'El nombre es requerido', errors: { nombre: ['Requerido'] } }, { status: 422 })
  }

  const estado = await prisma.estado.update({
    where: { id },
    data: {
      nombre:      nombre.trim(),
      descripcion: descripcion?.trim() || null,
      color:       color || 'secondary',
    },
  })

  return NextResponse.json({ success: true, data: estado, message: 'Estado actualizado' })
}

// DELETE /api/v1/configuracion/estados-proyecto/:id — eliminar si no hay proyectos usándolo
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const usados = await prisma.proyecto.count({ where: { estadoId: id } })
  if (usados > 0) {
    return NextResponse.json({
      success: false,
      message: `No se puede eliminar: ${usados} proyecto(s) usan este estado. Cambia su estado primero.`,
    }, { status: 422 })
  }

  await prisma.estado.delete({ where: { id } })
  return NextResponse.json({ success: true, data: null, message: 'Estado eliminado' })
}
