import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

// GET /api/v1/empleados?activo=true
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.EMPLEADOS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const soloActivos = searchParams.get('activo') === 'true'

  const empleados = await prisma.empleado.findMany({
    where: soloActivos ? { activo: true } : {},
    include: { perfilBase: { select: { id: true, nombre: true, nivel: true } } },
    orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
  })

  return NextResponse.json({ success: true, data: empleados })
}

// POST /api/v1/empleados
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.EMPLEADOS.CREAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const { nombre, apellido, email, costoHora, perfilBaseId, activo } = await request.json()

  const errors = {}
  if (!nombre?.trim())               errors.nombre    = ['Requerido']
  if (!apellido?.trim())             errors.apellido  = ['Requerido']
  if (costoHora === undefined || costoHora === null || costoHora < 0)
                                     errors.costoHora = ['Debe ser 0 o mayor']

  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors }, { status: 422 })
  }

  const empleado = await prisma.empleado.create({
    data: {
      nombre:      nombre.trim(),
      apellido:    apellido.trim(),
      email:       email?.trim() || null,
      costoHora:   Number(costoHora),
      perfilBaseId: perfilBaseId ? parseInt(perfilBaseId) : null,
      activo:      activo !== undefined ? Boolean(activo) : true,
    },
    include: { perfilBase: { select: { id: true, nombre: true, nivel: true } } },
  })

  return NextResponse.json({ success: true, data: empleado, message: 'Empleado creado' }, { status: 201 })
}
