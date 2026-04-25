import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

// GET /api/v1/empleados/:id
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.EMPLEADOS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const empleado = await prisma.empleado.findUnique({
    where: { id },
    include: { perfilBase: { select: { id: true, nombre: true, nivel: true } } },
  })

  if (!empleado) return NextResponse.json({ success: false, message: 'Empleado no encontrado' }, { status: 404 })
  return NextResponse.json({ success: true, data: empleado })
}

// PUT /api/v1/empleados/:id
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.EMPLEADOS.EDITAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { nombre, apellido, email, costoHora, salarioMensual, perfilBaseId, activo } = await request.json()

  const errors = {}
  if (!nombre?.trim())   errors.nombre   = ['Requerido']
  if (!apellido?.trim()) errors.apellido = ['Requerido']
  if (costoHora === undefined || costoHora === null || costoHora < 0)
                         errors.costoHora = ['Debe ser 0 o mayor']

  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors }, { status: 422 })
  }

  const empleado = await prisma.empleado.update({
    where: { id },
    data: {
      nombre:         nombre.trim(),
      apellido:       apellido.trim(),
      email:          email?.trim() || null,
      costoHora:      Number(costoHora),
      salarioMensual: salarioMensual != null ? Number(salarioMensual) : null,
      perfilBaseId:   perfilBaseId ? parseInt(perfilBaseId) : null,
      activo:         activo !== undefined ? Boolean(activo) : undefined,
    },
    include: { perfilBase: { select: { id: true, nombre: true, nivel: true } } },
  })

  return NextResponse.json({ success: true, data: empleado, message: 'Empleado actualizado' })
}

// DELETE /api/v1/empleados/:id
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.EMPLEADOS.ELIMINAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const [enTarifario, enCaso, enProyecto] = await Promise.all([
    prisma.tarifarioLinea.count({ where: { empleadoId: id } }),
    prisma.casoNegocioLinea.count({ where: { empleadoId: id } }),
    prisma.proyectoCasoNegocioLinea.count({ where: { empleadoId: id } }),
  ])

  if (enTarifario + enCaso + enProyecto > 0) {
    return NextResponse.json({
      success: false,
      message: 'Este empleado está asignado en tarifarios o casos de negocio. Desactívalo en lugar de eliminarlo.',
    }, { status: 409 })
  }

  await prisma.empleado.delete({ where: { id } })
  return NextResponse.json({ success: true, message: 'Empleado eliminado' })
}
