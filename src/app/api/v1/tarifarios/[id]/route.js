import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

// GET /api/v1/tarifarios/:id
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const tarifario = await prisma.tarifario.findUnique({
    where: { id },
    include: {
      lineas: {
        include: {
          perfil:   { select: { id: true, nombre: true, nivel: true } },
          empleado: { select: { id: true, nombre: true, apellido: true, costoHora: true } },
        },
        orderBy: { perfil: { nombre: 'asc' } },
      },
      empresas: { select: { id: true, nombre: true } },
    },
  })

  if (!tarifario) return NextResponse.json({ success: false, message: 'Tarifario no encontrado' }, { status: 404 })
  return NextResponse.json({ success: true, data: tarifario })
}

// PUT /api/v1/tarifarios/:id
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { nombre, descripcion, activo } = await request.json()

  if (!nombre?.trim()) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors: { nombre: ['Requerido'] } }, { status: 422 })
  }

  const tarifario = await prisma.tarifario.update({
    where: { id },
    data: {
      nombre:      nombre.trim(),
      descripcion: descripcion?.trim() || null,
      activo:      activo !== undefined ? Boolean(activo) : undefined,
    },
    include: { _count: { select: { lineas: true } } },
  })

  return NextResponse.json({ success: true, data: tarifario, message: 'Tarifario actualizado' })
}

// DELETE /api/v1/tarifarios/:id
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.ELIMINAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const enUso = await prisma.empresa.count({ where: { tarifarioId: id } })
  if (enUso > 0) {
    return NextResponse.json({
      success: false,
      message: `Este tarifario está asignado a ${enUso} empresa(s). Desasígnalo antes de eliminarlo.`,
    }, { status: 409 })
  }

  await prisma.tarifario.delete({ where: { id } })
  return NextResponse.json({ success: true, message: 'Tarifario eliminado' })
}
